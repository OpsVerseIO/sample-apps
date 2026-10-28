# ObserveNow User Journey Monitoring Sample Application

A small e-commerce store ("Observable Outfitters") used as the target app for
user journey monitoring with OpenTelemetry / Grafana Faro, an OTel Collector and
Grafana dashboards.

**Sample app Tech Stack**

- Next.js 16 (App Router) + React 19 + TypeScript
- In-memory backend (cart, orders, fake payment provider) via Next.js Route Handlers

**How to run**

```
$ npm install
$ npm run dev

// Visit http://localhost:3000
```

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
