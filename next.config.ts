import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      // Static export serves remote images directly; the deployed CSP below is the
      // authoritative, shared allowlist and blocks every unapproved image host.
      { protocol: "https", hostname: "**", pathname: "/**" },
    ],
  },
  trailingSlash: true,
};

export default nextConfig;
