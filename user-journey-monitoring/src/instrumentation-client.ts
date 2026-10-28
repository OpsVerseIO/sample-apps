import { initBrowserTelemetry, trackRouteChange } from "./observability/browser";

initBrowserTelemetry({
  collectorUrl: process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL ?? "http://localhost:8027/collect",
  appName: process.env.NEXT_PUBLIC_FARO_APP_NAME ?? "shop-web",
  appNamespace: "observable-outfitters",
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
});

export const onRouterTransitionStart = trackRouteChange;
