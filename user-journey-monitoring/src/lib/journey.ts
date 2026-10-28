// User journey events. Each step of the purchase funnel is pushed to Faro as
// a `journey_step` event; the OTel Collector turns these into the
// `journey_step_total{step,outcome,error_reason}` metric used by the funnel
// dashboard, and keeps the raw events (with session id) in Loki.
import { faro } from "@grafana/faro-web-sdk";

export const JOURNEY_STEPS = [
  "browse",
  "view_product",
  "add_to_cart",
  "view_cart",
  "begin_checkout",
  "place_order",
  "order_confirmed",
] as const;

export type JourneyStep = (typeof JOURNEY_STEPS)[number];

export function trackJourneyStep(
  step: JourneyStep,
  outcome: "success" | "failure" = "success",
  attributes: Record<string, string | number | undefined> = {},
) {
  const attrs: Record<string, string> = { step, outcome, error_reason: "none" };
  for (const [k, v] of Object.entries(attributes)) {
    if (v !== undefined) attrs[k] = String(v);
  }
  faro.api?.pushEvent("journey_step", attrs, "journey");
}
