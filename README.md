# TimoETA

A clean, fast ETA (Estimated Time of Arrival) web application for Hong Kong public transit. Get real-time arrival information for KMB buses, MTR trains, and Light Rail.

## Features

### KMB Bus ETAs

- Real-time arrival times for KMB bus routes
- Stop search by name/code with infinite scroll + fuzzy matching
- Stop grouping for the same stop name (e.g., opposite road sides)
- Route filtering (simple comma-separated or advanced multi-select)
- Color-coded route badges by type (Airport, Overnight, Cross-harbour, etc.)
- **Fare information** for routes with supported fare data

### MTR Next Train

- Arrival times for MTR lines
- Station search by name
- View arrivals for all lines serving a station
- Color-coded line indicators
- Batched API with 429 backoff handling for improved reliability

### Light Rail Schedule

- Real-time arrivals for LRT
- Station search by name
- View platform-specific arrivals

### General Features

- Auto-refresh (10s, 15s, 30s, 60s, or off)
- **Saved stops/stations management** via centralized sheet UI
- **Favorites pinning and grouping** — Pin favorites to top and group by transport mode
- **Deep linking** — Shareable URLs preserve mode, stop, and route filter state
- **Stale indicators** — Age-based visual cues for data freshness
- Favorites + Recent searches with local persistence
- Multi-language support (English, Traditional Chinese, Simplified Chinese for KMB/NLB/GMB)
- Dark/Light theme
- Responsive design for mobile and desktop
- Micro-caching with TTL and request deduplication

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**: Zustand (persisted to localStorage)
- **Language**: TypeScript
- **Testing**: Vitest
- **Search**: Fuse.js (fuzzy matching)
- **Package Manager**: bun (preferred, via `bun.lock`) with npm/yarn/pnpm support
- **Transit Data**: [hk-bus-eta](https://github.com/hkbus/hk-bus-eta) npm package (KMB, MTR, LRT routes, stops, ETAs, and fares)

## Getting Started

### Live Demo

This app is deployed and running here:

- https://eta.hkjc.uk

### User Guide

For comprehensive documentation on how to use TimoETA, see the **[User Guide](USER_GUIDE.md)**.

The guide covers:

- Detailed instructions for KMB Bus, MTR, and Light Rail features
- Managing favorites and recent searches
- Auto-refresh, language support, and themes
- Deep linking and sharing
- Tips, tricks, and troubleshooting

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/timothy0509/eta.git
cd eta

# Install dependencies (with bun)
bun install

# Or with npm/yarn/pnpm
npm install

# Start the development server
npm run dev

# Or with bun
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start

# Or with bun
bun run build
bun start
```

### Fare Data

Fare data is now provided directly by the [hk-bus-eta](https://github.com/hkbus/hk-bus-eta) npm package.

No local fare data extraction or Git LFS is required. The package includes up-to-date fare information for KMB routes as part of its EtaDb database.

## Architecture

- **Direct Client Fetching**: All transit API calls are made client-side, eliminating API route overhead
- **Bundle Splitting**: Transport mode panes (KMB/MTR/LRT) load on-demand for faster initial load
- **Caching**: In-memory MicroCache with TTL + IndexedDB persistence for ETA database
- **Testing**: Vitest with tests in `lib/**/*.test.ts`

## Project Structure

```
app/
  page.tsx
  layout.tsx
  globals.css

components/
  eta/
    panes/              # Mode-specific pane components
      kmb-pane.tsx      # KMB main interface
      lrt-pane.tsx      # LRT main interface
      mtr-pane.tsx      # MTR main interface
    auto-refresh.tsx    # Auto-refresh menu
    favorites.tsx       # Favorites panel with pinning and grouping
    lang-sync.tsx       # Language synchronization
    language-toggle.tsx # Language selector
    lrt-stop-search.tsx # LRT stop search
    mode-tabs.tsx       # KMB/MTR/LRT tab switcher
    pane-skeleton.tsx   # Loading skeleton for panes
    results-kmb.tsx     # KMB ETA results display
    results-lrt.tsx     # LRT schedule display
    results-mtr.tsx     # MTR schedule display
    route-badge.tsx     # Color-coded route badge component
    route-filter.tsx    # Route filter (simple/advanced modes)
    station-search.tsx  # MTR station search
    stop-search.tsx     # KMB stop search
  ui/                    # shadcn/ui components

lib/
  data/
    lrt-stations.ts     # LRT station definitions
    mtr-stations.ts     # MTR station definitions
  eta/
    cache/              # Caching infrastructure
      idb.ts            # IndexedDB persistence
      keys.ts           # Cache key definitions
      micro-cache.ts    # In-memory cache with TTL
      policy.ts         # Cache policy configuration
    direct/             # Direct fetch clients (replaces API routes)
      eta-db.ts         # ETA database client
      eta-db-list.ts    # ETA database list manager
      kmb.ts            # KMB direct fetch client
      lrt.ts            # LRT direct fetch client
      mtr.ts            # MTR direct fetch client
      shared.ts         # Shared direct fetch utilities
    cache.ts            # Cache initialization
    client.ts           # API client functions
    eta-db-index.ts     # ETA database indexing
    format.ts           # ETA formatting utilities
    hk-bus-eta.ts      # Adapter layer for hk-bus-eta package
    http.ts             # HTTP fetch utilities with error handling
    kmb-cache.ts        # KMB-specific caching logic
    kmb-fares.ts        # KMB fare computation (uses hk-bus-eta)
    kmb-stop-name.ts    # Stop name processing
    kmb.ts              # KMB provider (mapped from hk-bus-eta)
    line-colors.ts      # MTR/LRT line color mappings
    lrt.ts              # LRT provider (mapped from hk-bus-eta)
    mtr.ts              # MTR provider (mapped from hk-bus-eta)
    promise-pool.ts     # Concurrent request management
    route-badge.ts      # Route badge color logic
    stale.ts            # Stale data detection logic
    types.ts            # Shared types
    url-state.ts        # URL state serialization for deep linking
    use-auto-refresh.ts # Auto-refresh hook
    use-infinite-scroll.ts    # Infinite scroll hook
    use-lrt-schedule.ts # LRT schedule data hook
    use-mtr-schedule.ts # MTR schedule data hook
  store.ts              # Zustand store (favorites, settings)
  utils.ts              # General utilities
```

## Data Sources

This application uses the [hk-bus-eta](https://github.com/hkbus/hk-bus-eta) npm package, which provides:

- **KMB**: Bus routes, stops, ETAs, and fare data (sourced from official KMB APIs)
- **MTR**: Train routes, stations, and next train ETAs (sourced from official MTR APIs)
- **Light Rail**: Routes, stations, and arrival schedules (sourced from official LRT APIs)

The hk-bus-eta package maintains a single, cached EtaDb that aggregates all transit data with proper caching, holiday schedules, and service day logic.

## Configuration

All map endpoints are build/deploy configuration with sane defaults checked in to `lib/env.ts`. Overrides go through `NEXT_PUBLIC_*` environment variables at build time (they are inlined into the client bundle) and at server runtime (the CSP's `connect-src` and the preconnect hints in `app/layout.tsx` are derived from the same values, so a different tile host works end to end without source changes). The tile archive default is same-origin on purpose: some mobile networks block or degrade third-party tile hosts, and same-origin never is. `scripts/fetch-map-data.mjs` runs as the `predev`/`prebuild` step and keeps `public/map/hong-kong.pmtiles` (gitignored) fresh from the `hk-pmtiles-generation` build output; `FORCE_MAP_TILE_FETCH=1` forces a re-download, `MAP_TILE_FETCH_URL` points it at another mirror.

| Variable                               | Default                              | Purpose                                                                                                                                       |
| -------------------------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`                 | `https://eta.hkjc.uk`                | Canonical/OG base URL                                                                                                                         |
| `NEXT_PUBLIC_MAP_TILE_ARCHIVE_URL`     | `/map/hong-kong.pmtiles`             | Vector basemap (PMTiles); fetched at build time into `public/map/` and served same-origin                                                     |
| `NEXT_PUBLIC_MAP_GLYPHS_URL`           | `/map/fonts/{fontstack}/{range}.pbf` | Label glyph fonts, mirrored at build time into `public/map/fonts/` (CJK renders locally, never fetched)                                       |
| `NEXT_PUBLIC_MAP_SPRITE_URL`           | `/map/sprite/sprite`                 | Label/POI sprite sheet, mirrored at build time into `public/map/sprite/`                                                                      |
| `NEXT_PUBLIC_ROUTE_WAYPOINTS_BASE_URL` | `/map-waypoints`                     | Prebuilt route path geometry, same-origin passthrough (`app/map-waypoints/[...file]`; upstream is `NEXT_PUBLIC_ROUTE_WAYPOINTS_UPSTREAM_URL`) |
| `NEXT_PUBLIC_OSRM_BASE_URL`            | `https://router.project-osrm.org`    | Fallback route geometry router                                                                                                                |

## Attribution

**Map data.** The basemap tiles and fallback route geometry are built on data from [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, under the Open Database License. ODbL requires this attribution to be visible on maps that display its data; the app shows it in the map's attribution control, and it is repeated here.

**Bundled software.** The app bundles the following, whose copyright and license notices are retained with the distribution as their BSD-3-Clause license requires: [MapLibre GL JS](https://github.com/maplibre/maplibre-gl), [`pmtiles`](https://github.com/protomaps/PMTiles), and [`@protomaps/basemaps`](https://github.com/protomaps/basemaps) (all BSD-3-Clause).

**Transit data.** Where government open data is redistributed, its source is acknowledged as required by the DATA.GOV.HK terms of use: 資料來源：資料一線通 (Source: DATA.GOV.HK).

## License

MIT
