// Browser-side Grafana Faro. Runs before the app becomes interactive.
// Faro posts to the OTel Collector's `faro` receiver (not directly to Grafana),
// which converts it to OTLP logs + traces and forwards it upstream.
import { faro, getWebInstrumentations, initializeFaro, LogLevel } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

const collectorUrl = process.env.NEXT_PUBLIC_FARO_COLLECTOR_URL ?? "http://localhost:8027/collect";

try {
  initializeFaro({
    url: collectorUrl,
    app: {
      name: process.env.NEXT_PUBLIC_FARO_APP_NAME ?? "shop-web",
      namespace: "observable-outfitters",
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0",
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    },
    sessionTracking: { enabled: true, persistent: true },
    consoleInstrumentation: {
      // Capture console.info/warn/error; skip the noisy levels.
      disabledLevels: [LogLevel.DEBUG, LogLevel.TRACE, LogLevel.LOG],
      // Send console.error as a log, so "JS errors" only counts real exceptions.
      consoleErrorAsLog: true,
    },
    instrumentations: [
      ...getWebInstrumentations({ captureConsole: true }),
      // Adds `traceparent` to same-origin fetches (/api/*) so browser spans
      // and Next.js server spans join into one trace.
      new TracingInstrumentation(),
    ],
  });
} catch (err) {
  console.warn("Faro failed to initialize", err);
}

// App Router navigations are client-side, so tell Faro about the new view.
export function onRouterTransitionStart(url: string) {
  faro.api?.setView({ name: new URL(url, window.location.origin).pathname });
}
