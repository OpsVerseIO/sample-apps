const opentelemetry = require("@opentelemetry/sdk-node");
const { getNodeAutoInstrumentations } = require("@opentelemetry/auto-instrumentations-node");
const { Resource } = require("@opentelemetry/resources");
const { SemanticResourceAttributes } = require("@opentelemetry/semantic-conventions");

const { ZipkinExporter } = require("@opentelemetry/exporter-zipkin");
const { CompositePropagator } = require("@opentelemetry/core");
const { B3Propagator, B3InjectEncoding } = require("@opentelemetry/propagator-b3");
const api = require("@opentelemetry/api");

const options = {
    headers: {
        Authorization: "Basic <base64_encode(<clientId:secret>)>",
    },
    url: "<opsverse_collector_url>",
};
const exporter = new ZipkinExporter(options);

const sdk = new opentelemetry.NodeSDK({
    traceExporter: exporter,
    instrumentations: [getNodeAutoInstrumentations()],
    resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "node-express-server",
    }),
});

api.propagation.setGlobalPropagator(
    new CompositePropagator({
        propagators: [
            new B3Propagator(),
            new B3Propagator({ injectEncoding: B3InjectEncoding.MULTI_HEADER }),
        ],
    })
);

sdk.start();