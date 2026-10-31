# Instrumenting a user journey

How this sample is instrumented, and how to do the same in your own app. All
reusable code lives in [`src/observability/`](src/observability); the app only
calls into it.

```
Browser ── Faro SDK ──(Faro JSON)──► OTel Collector  faro receiver ─┐
Server  ── OTel SDK ──(OTLP)───────► OTel Collector  otlp receiver ─┤
                                                                    ▼
             parse Faro events → count journey steps → Loki / Prometheus / Jaeger
```

| You get | From |
| --- | --- |
| Funnel metric `journey_steps_total{journey_name, journey_step, journey_outcome, journey_error_reason}` | `journey_step` events, counted by the collector |
| Per-session timeline (journey steps, page views, console logs, errors, Web Vitals) | Faro → Loki, keyed by `session_id` |
| One trace per click: browser fetch → API route → custom spans | Faro tracing + server OTel, joined via `traceparent` |
| Business metrics (orders, payment latency, …) | Your own counters/histograms on the server |

## The kit

| File | Runs on | Exports |
| --- | --- | --- |
| `observability/server.ts` | Node.js | `initServerTelemetry({ serviceName, serviceNamespace })` |
| `observability/browser.ts` | browser | `initBrowserTelemetry({ collectorUrl, appName, appNamespace })`, `trackRouteChange` |
| `observability/journey.ts` | anywhere | `defineJourney(name, steps)`, types |
| `observability/journey-client.tsx` | browser | `trackJourneyStep`, `useJourneyStep`, `<TrackJourneyStep>` |
| `observability/tracing.ts` | server | `withSpan`, `annotate`, `recordOutcome` |

In this app, instrumentation inside business code is 37 lines across 8 files (about
half of them imports): one tracking call per journey step, plus spans and outcomes
in the two API routes. App-specific setup is 4 small files: `instrumentation.ts`,
`instrumentation-client.ts`, `lib/journeys.ts` and `lib/shop-metrics.ts`.

## Step by step

### 1. Install

```
npm install @grafana/faro-web-sdk @grafana/faro-web-tracing \
  @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/sdk-metrics @opentelemetry/resources \
  @opentelemetry/semantic-conventions @opentelemetry/exporter-trace-otlp-proto @opentelemetry/exporter-metrics-otlp-proto
```

Keep `@opentelemetry/*` on the same release line as `@grafana/faro-web-tracing`
(here: API 1.9, SDK 2.x / 0.223.x) to avoid duplicate API versions.

### 2. Server setup — `src/instrumentation.ts`

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {        // NodeSDK is not edge-compatible
    const { initServerTelemetry } = await import("./observability/server");
    initServerTelemetry({ serviceName: "shop-server", serviceNamespace: "observable-outfitters" });
  }
}
```

Endpoint and auth come from standard env vars: `OTEL_EXPORTER_OTLP_ENDPOINT`,
`OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_RESOURCE_ATTRIBUTES`. Next.js then emits a
span per request on its own.

### 3. Browser setup — `src/instrumentation-client.ts`

```ts
import { initBrowserTelemetry, trackRouteChange } from "./observability/browser";

initBrowserTelemetry({
  collectorUrl: process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL!,   // the collector's faro receiver
  appName: "shop-web",
  appNamespace: "observable-outfitters",
});

export const onRouterTransitionStart = trackRouteChange;     // client-side navigations
```

This gives sessions, page views, Web Vitals, errors, console info/warn/error,
frustration signals (dead/rage clicks) and fetch spans with no further code.

### 4. Define the journey — `src/lib/journeys.ts`

```ts
export const checkoutJourney = defineJourney("checkout", [
  "browse", "view_product", "add_to_cart", "view_cart", "begin_checkout", "place_order", "order_confirmed",
]);
```

Step names are type-checked everywhere the journey is used. An app can define
several journeys (`signup`, `onboarding`, …); they are separated by `journey_name`.

### 5. Track each step

Pick the form that fits where the step happens:

```tsx
// Server-rendered page: fires once on mount
<TrackJourneyStep journey={checkoutJourney} step="view_product" attributes={{ product_id: product.id }} />

// Client component: fires once, when the data is ready
useJourneyStep(checkoutJourney, "view_cart", { when: !loading, attributes: { item_count: cart.itemCount } });

// Event handler: success or failure, with a reason
trackJourneyStep(checkoutJourney, "place_order", "failure", { error_reason: "card_declined" });
```

Track a step where the user **reached** it (page shown, action completed), not
where it was attempted, so the funnel measures real progress.

### 6. Server spans and outcomes

```ts
annotate({ "cart.id": cartId, "cart.value_usd": total });                 // attributes on the request span

const invalid = await withSpan("checkout.validate", {}, async () => validate(input));
if (invalid) {
  recordOutcome("checkout", "failure", { reason: invalid.error, counter: checkoutAttempts });
  return NextResponse.json(invalid, { status: 400 });
}

await withSpan("payment.charge", { "payment.amount_usd": total },
  () => chargeCard(card, total), { duration: paymentDuration });           // span + latency histogram

recordOutcome("checkout", "success", { counter: checkoutAttempts, attributes: { "order.id": id } });
```

- `withSpan` records exceptions, sets error status and (optionally) the duration with an `outcome` label.
- `recordOutcome` writes `<operation>.outcome` / `<operation>.error_reason` on the span **and** increments the counter, so traces and metrics always agree.

### 7. Business metrics

Keep them in the app, not the kit (see [`src/lib/shop-metrics.ts`](src/lib/shop-metrics.ts)):

```ts
const meter = metrics.getMeter("observable-outfitters");
export const checkoutAttempts = meter.createCounter("shop.checkout.attempts", { unit: "{attempt}" });
```

Use low-cardinality attributes only (`outcome`, `error.reason`, `product.category`).
Never put session IDs, user IDs or order IDs on metrics — put them on spans and logs.

## Journey event contract

The collector and dashboards depend on these names. Don't change them per app.

| Faro event attribute | Collector attribute | Loki structured metadata | Metric label |
| --- | --- | --- | --- |
| event name `journey_step` | `event.name` | `event_name` | (filter only) |
| `journey` | `journey.name` | `journey_name` | `journey_name` |
| `step` | `journey.step` | `journey_step` | `journey_step` |
| `step_index` | – | (in log body) | – |
| `outcome` (`success`/`failure`) | `journey.outcome` | `journey_outcome` | `journey_outcome` |
| `error_reason` (`none` on success) | `journey.error_reason` | `journey_error_reason` | `journey_error_reason` |
| session (automatic) | `session.id` | `session_id` | – (never a label) |

Any other attributes you pass (`product_id`, `cart_value_usd`, …) stay in the
Loki log body for drilldown and are not counted.

## Collector requirements

The reference config is [`otel-collector/config.yaml`](otel-collector/config.yaml).
Whatever collector you send to (local, in-cluster, ObserveNow) needs:

| Component | Why |
| --- | --- |
| `faro` receiver with CORS for your app's origin | Faro does not speak OTLP |
| `allowed_headers: [content-type, content-encoding, idempotency-key, x-api-key, x-faro-session-id]` | Browser preflights fail otherwise and **no** browser data arrives |
| `transform/faro_events` with `context: log` | Faro events arrive as logfmt text; this lifts the contract attributes out |
| `count/journey` connector | Turns `journey_step` events into `journey_steps_total` |
| `deltatocumulative` in the metrics pipeline | The count connector emits deltas; Prometheus remote write drops them |
| `otlp` receiver | Server traces and metrics |

## Dashboards

Import `grafana/funnel.json` and `grafana/session-drilldown.json`. Set the
`journey`, `app` and `ns` variables to your values. The funnel panels list the
checkout step names explicitly (one query per step, to keep funnel order) —
edit those queries for a journey with different steps.

## Verify

```
# 1. Browser preflight is allowed (expect Access-Control-Allow-Origin)
curl -si -X OPTIONS https://<faro-endpoint>/collect -H 'Origin: https://<your-app>' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,idempotency-key,x-faro-session-id' | grep -i access-control

# 2. Journey events in Loki
{service_name="shop-web"} | event_name="journey_step"

# 3. Funnel metric
sum by (journey_step) (journey_steps_total{journey_name="checkout"})

# 4. Joined traces: in Jaeger, a shop-web trace should contain shop-server spans
```

Also check the browser console: CORS errors or `Delivery retries exhausted` from
`@grafana/faro-web-sdk:transport-fetch` mean the collector is rejecting Faro.

## Gotchas

**When you deploy** — these are not handled for you:

| Check | Why |
| --- | --- |
| Faro receiver `cors.allowed_origins` lists your real app origin(s) | Otherwise browsers silently drop all Faro data |
| The Faro endpoint is reachable from users' browsers, with TLS and rate limits | Browser telemetry can't carry secrets, so it is unauthenticated |
| `NEXT_PUBLIC_FARO_COLLECTOR_URL` is set at **build** time | `NEXT_PUBLIC_*` values are inlined into the browser bundle |
| Your Loki keeps `session_id` as structured metadata, not an index label | Indexing it creates one stream per session |

**Already handled** — don't undo these:

| Symptom if undone | Fix in place |
| --- | --- |
| Collector crash-loops: `unable to infer context from statements` | `context: log` on each `transform/faro_events` group |
| No browser data; console shows CORS errors | Full `allowed_headers` list (Faro 2.x sends `content-type` and `idempotency-key`) |
| Funnel metric never reaches Prometheus | `deltatocumulative` before the metrics exporter |
| Metric series collide across replicas | Unique `service.instance.id` per process (set by the kit) |
| Steps counted twice in dev | `useJourneyStep` guards against StrictMode's double effects |
| Dev server reloads the page in a loop | `logging.browserToTerminal: false` in `next.config.ts` (forwarded browser logs land in `.next/dev/logs` and re-trigger Fast Refresh); `turbopack.root` is pinned too |

**When writing your own queries**:

- The Prometheus `job` label is `service.namespace/service.name` (e.g. `observable-outfitters/shop-server`).
- Loki instant queries ignore legend names (bars show `Value #A`); set display names with field overrides.
- Faro's `view_name` is empty on the first page load; group by `page_url` instead.
- Backends that ingest traces via Zipkin (e.g. Jaeger) lowercase span names: `post /api/checkout`.

## Outside Next.js

- **Browser**: `initBrowserTelemetry` and `trackJourneyStep` are plain functions — call them from any framework's entry point. Only `useJourneyStep` / `<TrackJourneyStep>` need React.
- **Node.js**: call `initServerTelemetry` before the app loads (e.g. `node --import ./telemetry.js server.js`); `withSpan` / `recordOutcome` work unchanged.
- **Other languages**: send the same `journey_step` events as OTLP logs with the contract attributes above; add `otlp` to the `logs/journey` pipeline's receivers so they are counted too.
