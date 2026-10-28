export async function register() {
  // NodeSDK is not edge-compatible, so only load it in the Node.js runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initServerTelemetry } = await import("./observability/server");
    initServerTelemetry({ serviceName: "shop-server", serviceNamespace: "observable-outfitters" });
  }
}
