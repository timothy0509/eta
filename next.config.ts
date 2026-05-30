import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), camera=(), microphone=()',
  },
]

const nextConfig: NextConfig = {
  experimental: {
    // Limit worker count to reduce memory pressure during build.
    // Combined with --max-old-space-size=2048 in package.json (reduced from 5120),
    // this keeps build memory under ~2GB. The app has no large static data files
    // (hk-bus-eta is 81KB, local data files are 13KB total) and imports are tree-shaken.
    cpus: 4,
  },
  // Disable React Compiler to reduce memory usage during type checking
  // React Compiler does heavy type inference which can cause OOM on smaller heaps
  reactCompiler: false,

  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
  },

  // Enable compression
  compress: true,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

// Wrap with bundle analyzer only when ANALYZE env var is set
export default process.env.ANALYZE === 'true'
  ? withBundleAnalyzer({
      enabled: true,
      openAnalyzer: false,
    })(nextConfig)
  : nextConfig
