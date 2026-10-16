const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

// Map endpoints. NEXT_PUBLIC_* values are inlined at build time, so these
// are build/deploy configuration, not runtime-switchable — that keeps the
// client fetching model (and the CSP that guards it) honest.
const NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL = process.env.NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL
const NEXT_PUBLIC_MAP_GLYPHS_URL = process.env.NEXT_PUBLIC_MAP_GLYPHS_URL
const NEXT_PUBLIC_MAP_SPRITE_URL = process.env.NEXT_PUBLIC_MAP_SPRITE_URL
const NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL = process.env.NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL
const NEXT_PUBLIC_OSRM_BASE_URL = process.env.NEXT_PUBLIC_OSRM_BASE_URL

// Only validate at runtime, not during build.
// During `next build`, NODE_ENV is 'production' but the app isn't serving requests yet.
// We detect runtime by checking for NEXT_RUNTIME (set by Next.js at request time).
const isRuntime = typeof process.env.NEXT_RUNTIME !== 'undefined'

if (!NEXT_PUBLIC_SITE_URL && isRuntime) {
  console.warn('NEXT_PUBLIC_SITE_URL is not set, using default')
}

export const env = {
  NEXT_PUBLIC_SITE_URL: NEXT_PUBLIC_SITE_URL ?? 'https://eta.hkjc.uk',

  // Vector basemap served same-origin from public/map/hong-kong.pmtiles
  // (fetched at build time by scripts/fetch-map-tiles.mjs from the hkbus
  // dataset's Pages deploy), so tile loading never depends on a
  // third-party host surviving the user's network. The env override restores
  // the old behavior in one deploy-time variable.
  NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL: NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL ?? '/map/hong-kong.pmtiles',
  // Glyph + sprite endpoints backing label/icon rendering.
  NEXT_PUBLIC_MAP_GLYPHS_URL:
    NEXT_PUBLIC_MAP_GLYPHS_URL ?? 'https://fonts.protomaps.com/fonts/{fontstack}/{range}.pbf',
  NEXT_PUBLIC_MAP_SPRITE_URL:
    NEXT_PUBLIC_MAP_SPRITE_URL ?? 'https://sprites.protomaps.com/sprites/sprite',
  // Prebuilt route path geometry dataset from the hkbus project.
  NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL:
    NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL ?? 'https://hkbus.github.io/route-waypoints',
  // Fallback router for route geometry outside the waypoint dataset.
  NEXT_PUBLIC_OSRM_BASE_URL: NEXT_PUBLIC_OSRM_BASE_URL ?? 'https://router.project-osrm.org',
}
