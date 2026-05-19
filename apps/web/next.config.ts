import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@proofboard/shared-types", "@proofboard/analyzer"]
};

export default nextConfig;
