import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  experimental: {
    // Limit worker count to reduce memory pressure during build
    cpus: 4,
  },
  // Disable React Compiler to reduce memory usage during type checking
  // React Compiler does heavy type inference which can cause OOM on smaller heaps
  reactCompiler: false,

  // Optimize images
  images: {
    formats: ["image/webp", "image/avif"],
  },

  // Enable compression
  compress: true,
};

// Wrap with bundle analyzer only when ANALYZE env var is set
export default process.env.ANALYZE === "true"
  ? withBundleAnalyzer({
      enabled: true,
      openAnalyzer: false,
    })(nextConfig)
  : nextConfig;
