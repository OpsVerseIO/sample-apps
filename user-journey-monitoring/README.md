# ObserveNow User Journey Monitoring Sample Application

A small Next.js store ("Observable Outfitters") instrumented with Grafana Faro
(browser) and OpenTelemetry (server), sending through an OTel Collector to
ObserveNow, with Grafana dashboards for the purchase funnel and per-session drilldown.

To instrument your own app, see **[INSTRUMENTATION.md](INSTRUMENTATION.md)**.

## Run it

```
cp .env.example .env     # pick option A (local collector) or B (direct to ObserveNow)
docker compose up -d     # option A only; add --profile local for a local Grafana on :3001
npm install
npm run dev              # http://localhost:3000
npm run simulate -- 20   # optional: 20 random sessions via Playwright + local Chrome
```

Without a `.env`, the collector sends to the local Grafana stack (`--profile local`).

## How data flows

```
Browser ── Faro ──► collector :8027 (faro) ─┐
Server  ── OTLP ──► collector :4318 (otlp) ─┴─► parse Faro events, count journey steps ─► OTLP/HTTP ─► ObserveNow
```

| Data | What it's for |
| --- | --- |
| `journey_steps_total{journey_name, journey_step, journey_outcome, journey_error_reason}` | Funnel, drop-off, failure reasons |
| Faro logs with `session_id`, `journey_step` (Loki) | Per-session timeline, Web Vitals, JS errors, console |
| Traces: browser fetch → API route → `checkout.validate` / `payment.charge` | One trace per click |
| `shop_checkout_attempts_total`, `shop_order_value_*`, `shop_payment_duration_*`, `shop_cart_additions_total` | Business KPIs |

## The journey and its failure modes

`browse` → `view_product` → `add_to_cart` → `view_cart` → `begin_checkout` → `place_order` → `order_confirmed`

| Trigger | Result |
| --- | --- |
| Card ending in `0002` | `402 payment_declined` (`card_declined`) |
| `PAYMENT_FAILURE_RATE` (default `0.1`) | random `402 payment_declined` (`processor_error`), any card |
| `SLOW_PAYMENT_RATE` (default `0.1`) | payment takes 3–5s instead of 0.2–1s |
| More than 5 of one item | `409 out_of_stock` |

## Dashboards

Import `grafana/funnel.json` and `grafana/session-drilldown.json` (**Dashboards → New → Import**).
They expect data source UIDs `loki`, `metrics` (Prometheus-compatible) and `jaeger`.
