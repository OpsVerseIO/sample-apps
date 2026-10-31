import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root. Otherwise Turbopack may pick up a lockfile in a
  // parent directory and watch far more than this app.
  turbopack: { root: __dirname },
  // Don't forward browser console output into the dev log: the dev log lives
  // under .next/ inside the project, and writing to it re-triggered Fast
  // Refresh, so every page load logged → rebuilt → reloaded in a loop.
  logging: { browserToTerminal: false },
};

export default nextConfig;
