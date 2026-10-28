export async function register() {
  // NodeSDK is not edge-compatible, so only load it in the Node.js runtime.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation.node");
  }
}
