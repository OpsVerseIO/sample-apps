// Server-side helpers for custom spans and outcome metrics. Uses only the
// OpenTelemetry API, so it is a no-op when no SDK is registered.
import {
  SpanStatusCode,
  trace,
  type Attributes,
  type Counter,
  type Histogram,
  type Span,
} from "@opentelemetry/api";
import type { Outcome } from "./journey";

const tracer = trace.getTracer("app");

// Runs fn inside a child span. Exceptions are recorded on the span and
// rethrown. If `duration` is given, the elapsed seconds are recorded into it
// with an `outcome` attribute.
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
  { duration }: { duration?: Histogram } = {},
): Promise<T> {
  const start = performance.now();
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    let outcome: Outcome = "success";
    try {
      return await fn(span);
    } catch (err) {
      outcome = "failure";
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
      throw err;
    } finally {
      span.end();
      duration?.record((performance.now() - start) / 1000, { outcome });
    }
  });
}

// Adds attributes to the currently active span (e.g. the request span).
export function annotate(attributes: Attributes) {
  trace.getActiveSpan()?.setAttributes(attributes);
}

// Records the outcome of a business operation in one call: on the active
// span as `<operation>.outcome` / `<operation>.error_reason`, and on the
// counter as {outcome, error.reason}.
export function recordOutcome(
  operation: string,
  outcome: Outcome,
  { reason = "none", counter, attributes = {} }: { reason?: string; counter?: Counter; attributes?: Attributes } = {},
) {
  annotate({ [`${operation}.outcome`]: outcome, [`${operation}.error_reason`]: reason, ...attributes });
  counter?.add(1, { outcome, "error.reason": reason });
}
