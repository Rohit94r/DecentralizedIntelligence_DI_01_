import type { NextConfig } from "next";

/**
 * The web app and the API share ONE origin: every /api/* request is proxied to
 * the Fastify API (LAYERFLOW_API_URL, default http://127.0.0.1:4000). Judges get a
 * single URL, the browser never needs CORS, and `curl <url>/api/submit` works.
 */
const API = process.env.LAYERFLOW_API_URL ?? "http://127.0.0.1:4000";

const nextConfig: NextConfig = {
  // LAYERFLOW_NEXT_DIST lets a second build (e.g. a verification build) live beside the served one
  distDir: process.env.LAYERFLOW_NEXT_DIST ?? ".next",
  poweredByHeader: false,
  devIndicators: false,
  experimental: {
    // a red-team submission can legitimately take several seconds
    proxyTimeout: 90_000,
  },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API}/api/:path*` }];
  },
};

export default nextConfig;
