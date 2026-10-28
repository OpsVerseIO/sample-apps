# ObserveNow User Journey Monitoring Sample Application

A small e-commerce store ("Observable Outfitters") used as the target app for
user journey monitoring with OpenTelemetry / Grafana Faro, an OTel Collector and
Grafana dashboards.

**Sample app Tech Stack**

- Next.js 16 (App Router) + React 19 + TypeScript
- In-memory backend (cart, orders, fake payment provider) via Next.js Route Handlers

- Grafana Faro (browser) + OpenTelemetry Node SDK (server) -> OTel Collector (contrib)

**Instrumenting your own app?** See [INSTRUMENTATION.md](INSTRUMENTATION.md) for a
step-by-step guide to the reusable kit in `src/observability/`, the journey event
contract, and the gotchas we hit.

**How to run**

```
$ cp .env.example .env            # set your ObserveNow collector endpoint + credentials
$ docker compose up -d            # OTel Collector (add --profile local for a local Grafana stack)
$ npm install
$ npm run dev

// Visit http://localhost:3000 and walk through a purchase
```

## Telemetry flow

```
Browser ── Faro SDK ──(faro json)──► OTel Collector :8027  faro receiver ─┐
Next.js ── OTel SDK ──(OTLP)───────► OTel Collector :4318  otlp receiver ─┤
                                                                          ▼
                    transform (parse Faro events) → count / spanmetrics connectors
                                                                          ▼
                                  upstream exporter(s) → ObserveNow / any OTLP backend
```

Faro does not speak OTLP, so the collector's `faro` receiver (contrib, alpha)
translates it into OTLP logs (events, errors, Web Vitals) and traces.

| Signal | Source | What you get |
| --- | --- | --- |
| `journey_steps_total{journey_name,journey_step,journey_outcome,journey_error_reason}` | Faro `journey_step` events → `count` connector | Funnel, drop-off, decline rates |
| `traces_span_metrics_*` | All spans → `spanmetrics` connector | RED metrics per route / span |
| `shop_checkout_attempts_total`, `shop_order_value`, `shop_payment_duration`, `shop_cart_additions_total` | Server OTel metrics | Business KPIs |
| Logs with `session.id`, `journey.name`, `journey.step` attributes | Faro → collector | Per-session drilldown |
| Traces | Faro fetch spans + Next.js route spans (joined via `traceparent`) | Click → API → payment in one trace |

The destination is set in `.env` — see `.env.example`: either through the local
collector (option A) or straight to an ObserveNow Faro + OTLP endpoint (option B).
Without `.env`, the collector sends to the optional local Grafana stack
(`docker compose --profile local up`, Grafana on http://localhost:3001).

## The user journey

| Step | Page | Backend call |
| --- | --- | --- |
| 1. Browse catalog | `/` (optional `?category=`) | server render |
| 2. View product | `/products/[id]` | server render |
| 3. Add to cart | `/products/[id]` | `POST /api/cart` |
| 4. Review cart | `/cart` | `GET`/`PATCH /api/cart` |
| 5. Enter checkout details | `/checkout` | – |
| 6. Place order | `/checkout` | `POST /api/checkout` |
| 7. Order confirmation | `/orders/[id]` | server render |

## Built-in failure modes

The checkout path fails on purpose so there is drop-off and latency to observe:

| Trigger | Result |
| --- | --- |
| Card number ending in `0002` | `402 payment_declined` (`card_declined`) |
| `PAYMENT_FAILURE_RATE` (default `0.1`) | random `402 payment_declined` (`processor_error`) |
| `SLOW_PAYMENT_RATE` (default `0.1`) | payment takes 3–5s instead of 0.2–1s |
| More than 5 of one item in the cart | `409 out_of_stock` |

```
$ PAYMENT_FAILURE_RATE=0.3 SLOW_PAYMENT_RATE=0.2 npm run dev
```

## Grafana dashboards

`grafana/funnel.json` (funnel & KPIs) and `grafana/session-drilldown.json` (per-session timeline, traces, Web Vitals).
Import via **Dashboards → New → Import** (or provisioning / the HTTP API). They expect data sources with
UIDs `loki` (Loki), `metrics` (Prometheus-compatible) and `jaeger` (Jaeger).
