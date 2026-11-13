import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg"],
  images: { unoptimized: true },
  experimental: { serverActions: { bodySizeLimit: "5mb" } },
};

export default nextConfig;
