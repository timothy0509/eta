import type { NextConfig } from 'next'
import withBundleAnalyzer from '@next/bundle-analyzer'

import { env } from './lib/env'

// Fetchable origins for configurable map endpoints: whatever the build
// environment chooses must ALSO be allowed by the CSP, so the origins are
// derived from the same env values instead of being maintained separately.
const configuredMapOrigins = new Set<string>()
for (const url of [
  env.NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL,
  env.NEXT_PUBLIC_MAP_GLYPHS_URL,
  env.NEXT_PUBLIC_MAP_SPRITE_URL,
  env.NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL,
  env.NEXT_PUBLIC_OSRM_BASE_URL,
]) {
  try {
    configuredMapOrigins.add(new URL(url).origin)
  } catch {
    // A malformed override fails loudly in the map code; skip it here.
  }
}

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
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self' https://rt.data.gov.hk https://data.etabus.gov.hk https://data.etagmb.gov.hk https://data.hkbus.app https://opendata.mtr.com.hk https://www.lrtetas.hk " +
      Array.from(configuredMapOrigins).join(' ') +
      "; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
  },
]

const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-popover',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@radix-ui/react-toggle',
      '@radix-ui/react-toggle-group',
      '@radix-ui/react-tooltip',
      'cmdk',
      'sonner',
      'zustand',
      'fuse.js',
    ],
  },
  reactCompiler: true,
  compiler: {
    removeConsole: {
      exclude: ['warn', 'error'],
    },
  },

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
