import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=()",
  },
];

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

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

// Wrap with bundle analyzer only when ANALYZE env var is set
export default process.env.ANALYZE === "true"
  ? withBundleAnalyzer({
      enabled: true,
      openAnalyzer: false,
    })(nextConfig)
  : nextConfig;
