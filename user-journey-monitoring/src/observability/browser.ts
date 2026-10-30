// Browser-side Grafana Faro setup. Faro posts to an OTel Collector's `faro`
// receiver, which converts it to OTLP logs + traces.
import { faro, getWebInstrumentations, initializeFaro, LogLevel } from "@grafana/faro-web-sdk";
import { TracingInstrumentation } from "@grafana/faro-web-tracing";

export interface BrowserTelemetryOptions {
  collectorUrl: string;
  appName: string;
  appNamespace: string;
  appVersion?: string;
  environment?: string;
}

export function initBrowserTelemetry({
  collectorUrl,
  appName,
  appNamespace,
  appVersion = "0.0.0",
  environment = process.env.NODE_ENV,
}: BrowserTelemetryOptions) {
  try {
    initializeFaro({
      url: collectorUrl,
      app: { name: appName, namespace: appNamespace, version: appVersion, environment },
      sessionTracking: { enabled: true, persistent: true },
      consoleInstrumentation: {
        // Capture console.info/warn/error; skip the noisy levels.
        disabledLevels: [LogLevel.DEBUG, LogLevel.TRACE, LogLevel.LOG],
        // Send console.error as a log, so "JS errors" only counts real exceptions.
        consoleErrorAsLog: true,
      },
      instrumentations: [
        ...getWebInstrumentations({ captureConsole: true }),
        // Adds `traceparent` to same-origin fetches so browser spans and
        // server spans join into one trace.
        new TracingInstrumentation(),
      ],
    });
  } catch (err) {
    // Telemetry must never break the app.
    console.warn("Faro failed to initialize", err);
  }
}

// Client-side navigations don't reload the page, so tell Faro about the new view.
export function trackRouteChange(url: string) {
  faro.api?.setView({ name: new URL(url, window.location.origin).pathname });
}
