"use client";

import { useEffect, useRef } from "react";
import { trackJourneyStep, type JourneyStep } from "@/lib/journey";

// Fires a journey step once when the page mounts. Lets server-rendered pages
// report their step without becoming client components.
export function TrackJourneyStep({
  step,
  attributes,
}: {
  step: JourneyStep;
  attributes?: Record<string, string | number | undefined>;
}) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return; // StrictMode double-invokes effects in dev
    sent.current = true;
    trackJourneyStep(step, "success", attributes);
  }, [step, attributes]);
  return null;
}
