import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Limit worker count to reduce memory pressure during build
    cpus: 4,
  },
  // Disable React Compiler to reduce memory usage during type checking
  // React Compiler does heavy type inference which can cause OOM on smaller heaps
  reactCompiler: false,
};

export default nextConfig;
