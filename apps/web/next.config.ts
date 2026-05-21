import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@proofboard/shared-types",
    "@proofboard/analyzer",
    "@proofboard/property-engine",
    "@proofboard/harness-generator",
    "@proofboard/result-parser"
  ]
};

export default nextConfig;
