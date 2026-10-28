// Server-side OpenTelemetry setup (Node.js runtime only — NodeSDK is not
// edge-compatible). Traces and metrics go over OTLP/HTTP to an OTel Collector.
//
// Standard OTEL_* env vars apply and take precedence, e.g.:
//   OTEL_EXPORTER_OTLP_ENDPOINT   (default http://localhost:4318)
//   OTEL_EXPORTER_OTLP_HEADERS    (e.g. Authorization=Basic ...)
//   OTEL_SERVICE_NAME             (overrides serviceName)
//   OTEL_RESOURCE_ATTRIBUTES      (e.g. deployment.environment.name=dev)
import { hostname } from "node:os";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

export interface ServerTelemetryOptions {
  serviceName: string;
  serviceNamespace: string;
  serviceVersion?: string;
  metricExportIntervalMs?: number;
}

export function initServerTelemetry({
  serviceName,
  serviceNamespace,
  serviceVersion = process.env.npm_package_version ?? "0.0.0",
  metricExportIntervalMs = 15_000,
}: ServerTelemetryOptions) {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion,
      "service.namespace": serviceNamespace,
      // Unique per process so metrics from multiple replicas don't collide.
      "service.instance.id": `${hostname()}-${process.pid}`,
    }),
    traceExporter: new OTLPTraceExporter(),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter(),
      exportIntervalMillis: metricExportIntervalMs,
    }),
  });
  sdk.start();
  return sdk;
}
