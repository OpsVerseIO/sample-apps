"use client";

import { faro } from "@grafana/faro-web-sdk";
import { useEffect, useEffectEvent, useRef } from "react";
import type { Journey, JourneyAttributes, Outcome } from "./journey";

export type { Outcome };

// Sends one `journey_step` event (see ./journey.ts for the attribute contract).
export function trackJourneyStep<Step extends string>(
  journey: Journey<Step>,
  step: Step,
  outcome: Outcome = "success",
  attributes: JourneyAttributes = {},
) {
  const attrs: Record<string, string> = {
    journey: journey.name,
    step,
    step_index: String(journey.steps.indexOf(step)),
    outcome,
    error_reason: "none",
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) attrs[key] = String(value);
  }
  faro.api?.pushEvent("journey_step", attrs, "journey");
}

// Tracks a step once, the first time `when` is true (e.g. after data loads).
export function useJourneyStep<Step extends string>(
  journey: Journey<Step>,
  step: Step,
  { when = true, attributes }: { when?: boolean; attributes?: JourneyAttributes } = {},
) {
  const sent = useRef(false); // also guards StrictMode's double effect run in dev
  const track = useEffectEvent(() => trackJourneyStep(journey, step, "success", attributes));
  useEffect(() => {
    if (!when || sent.current) return;
    sent.current = true;
    track();
  }, [when]);
}

// Component form of useJourneyStep, for server-rendered pages.
export function TrackJourneyStep<Step extends string>(props: {
  journey: Journey<Step>;
  step: Step;
  attributes?: JourneyAttributes;
}) {
  useJourneyStep(props.journey, props.step, { attributes: props.attributes });
  return null;
}
