// Business metrics specific to this shop (the reusable parts live in
// src/observability). The API is a no-op when no SDK is registered.
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("observable-outfitters");

export const cartAdditions = meter.createCounter("shop.cart.additions", {
  description: "Items added to carts",
  unit: "{item}",
});

export const checkoutAttempts = meter.createCounter("shop.checkout.attempts", {
  description: "Checkout attempts by outcome and error reason",
  unit: "{attempt}",
});

export const orderValue = meter.createHistogram("shop.order.value", {
  description: "Value of successfully placed orders",
  unit: "USD",
  advice: { explicitBucketBoundaries: [10, 25, 50, 100, 200, 500, 1000] },
});

export const paymentDuration = meter.createHistogram("shop.payment.duration", {
  description: "Time spent waiting on the payment provider",
  unit: "s",
  advice: { explicitBucketBoundaries: [0.1, 0.25, 0.5, 1, 2, 3, 5, 10] },
});
