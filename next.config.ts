import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
      allowedOrigins: ["generativelanguage.googleapis.com"],
    },
  },
};

export default nextConfig;
