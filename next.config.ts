import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  output: "export",
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "swwest.com",
        pathname: "/Images/SunsetItems/**",
      },
      {
        protocol: "https",
        hostname: "halfwheel.com",
        pathname: "/wp-content/uploads/**",
      },
      {
        protocol: "https",
        hostname: "cigardojo.com",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
  trailingSlash: true,
};

export default nextConfig;
