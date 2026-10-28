// Server-side OpenTelemetry. Traces and metrics go over OTLP/HTTP to the
// local OTel Collector, which forwards them to the configured backend.
//
// Standard OTEL_* env vars apply, e.g.:
//   OTEL_EXPORTER_OTLP_ENDPOINT   (default http://localhost:4318)
//   OTEL_SERVICE_NAME             (default shop-server)
//   OTEL_RESOURCE_ATTRIBUTES      (e.g. deployment.environment.name=dev)
import { hostname } from "node:os";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from "@opentelemetry/semantic-conventions";

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? "shop-server",
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version ?? "0.1.0",
    "service.namespace": "observable-outfitters",
    // Unique per process so metrics from multiple app replicas don't collide.
    "service.instance.id": `${hostname()}-${process.pid}`,
  }),
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 15_000,
  }),
});

sdk.start();
