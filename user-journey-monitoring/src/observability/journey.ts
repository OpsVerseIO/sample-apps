// A user journey is an ordered list of steps (a funnel). Definitions are plain
// data so they can be passed from server components to client components.
//
// Every tracked step is sent as a `journey_step` event with these attributes —
// the OTel Collector and the dashboards rely on exactly these names:
//   journey       journey name, e.g. "checkout"
//   step          step name, e.g. "add_to_cart"
//   step_index    position in the journey (0-based), for ordering
//   outcome       "success" | "failure"
//   error_reason  failure reason, or "none"
export interface Journey<Step extends string = string> {
  name: string;
  steps: readonly Step[];
}

export function defineJourney<const Step extends string>(name: string, steps: readonly Step[]): Journey<Step> {
  return { name, steps };
}

export type StepOf<J> = J extends Journey<infer Step> ? Step : never;

export type JourneyAttributes = Record<string, string | number | undefined>;

export type Outcome = "success" | "failure";
