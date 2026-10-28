// Server-side business telemetry: tracer, meter and the journey metrics the
// Grafana dashboards are built on. Safe to import when no SDK is registered
// (the API falls back to no-ops).
import { metrics, SpanStatusCode, trace, type Attributes, type Span } from "@opentelemetry/api";

const SCOPE = "observable-outfitters";

export const tracer = trace.getTracer(SCOPE);
const meter = metrics.getMeter(SCOPE);

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

// Runs fn inside a child span, recording exceptions and ending the span.
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      return await fn(span);
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
    }
  });
}
