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
    value: 'geolocation=(self), camera=(), microphone=()',
  },
  {
    key: 'Content-Security-Policy',
    value:
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://maps.googleapis.com https://*.google.com https://*.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: https://*.googleapis.com https://*.gstatic.com; font-src 'self' data:; connect-src 'self' https://rt.data.gov.hk https://data.etabus.gov.hk https://data.etagmb.gov.hk https://data.hkbus.app https://hkbus.github.io https://opendata.mtr.com.hk https://www.lrtetas.hk https://*.googleapis.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
]

const nextConfig: NextConfig = {
  experimental: {
    // Limit worker count to reduce memory pressure during build.
    // Combined with --max-old-space-size=2048 in package.json (reduced from 5120),
    // this keeps build memory under ~2GB. The app has no large static data files
    // (hk-bus-eta is 81KB, local data files are 13KB total) and imports are tree-shaken.
    cpus: 4,
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-label',
      '@radix-ui/react-popover',
      '@radix-ui/react-separator',
      '@radix-ui/react-slot',
      '@radix-ui/react-switch',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'cmdk',
      'sonner',
    ],
  },
  reactCompiler: true,

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
