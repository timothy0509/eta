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
- Favorites + Recent searches with local persistence
- Multi-language support (English, Traditional Chinese, Simplified Chinese for KMB)
- Dark/Light theme
- Responsive design for mobile and desktop
- Micro-caching with TTL and request deduplication

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**: Zustand (persisted to localStorage)
- **Language**: TypeScript
- **Search**: Fuse.js (fuzzy matching)
- **Package Manager**: bun (preferred, via `bun.lock`) with npm/yarn/pnpm support
- **Data Management**: Git LFS (tracked fare data files)

## Getting Started

### Live Demo

This app is deployed and running here:

- https://eta.hkjc.uk

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

### Fare Data (Git LFS)

Fare data in `data/fare/` is tracked with Git LFS.

- If you are cloning fresh, install Git LFS and run `git lfs pull`.
- To rebuild the local fare index from the source data:
  - `npm run fare:build` (or `bun run fare:build`)

## Project Structure

```
app/
  api/
    kmb/
      eta/              # KMB ETA API proxy
      etas/             # Batch KMB ETA API proxy
      fares/            # KMB fare data API
      route/            # Route details API
      route-stop/       # Route-stop mapping
      routes/           # Route list API
      stops/            # Stop list API
      stop-etas/        # Per-stop ETA API
    lrt/
      schedule/         # LRT schedule API proxy
    mtr/
      schedule/         # MTR schedule API proxy
      schedules/        # Batch MTR schedule API
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
    favorites.tsx       # Saved panel (legacy, now in sheet)
    language-toggle.tsx # Language selector
    mode-tabs.tsx       # KMB/MTR/LRT tab switcher
    results-kmb.tsx     # KMB ETA results display
    results-lrt.tsx     # LRT schedule display
    results-mtr.tsx     # MTR schedule display
    route-badge.tsx     # Color-coded route badge component
    route-filter.tsx    # Route filter (simple/advanced modes)
    stop-search.tsx     # KMB and shared stop/station search
  ui/                    # shadcn/ui components

lib/
  data/
    lrt-stations.ts     # LRT station definitions
    mtr-stations.ts     # MTR station definitions
  eta/
    cache.ts            # In-memory micro-cache with TTL
    client.ts           # API client functions
    format.ts           # ETA formatting utilities
    http.ts             # HTTP utilities and 429 backoff
    kmb-cache.ts        # KMB-specific caching logic
    kmb-fares.ts        # KMB fare computation
    kmb-stop-name.ts    # Stop name processing
    kmb.ts              # KMB types and utilities
    line-colors.ts      # MTR/LRT line color mappings
    lrt.ts              # LRT types
    mtr.ts              # MTR types
    promise-pool.ts     # Concurrent request management
    route-badge.ts      # Route badge color logic
    types.ts            # Shared types
    use-auto-refresh.ts # Auto-refresh hook
    use-infinite-scroll.ts    # Infinite scroll hook
    use-lrt-schedule.ts # LRT schedule data hook
    use-mtr-schedule.ts # MTR schedule data hook
  store.ts              # Zustand store (favorites, settings)
  utils.ts              # General utilities

data/
  fare/                 # Git LFS-tracked fare data
    kmb-fare-index.v1.json
    kmb-fare-source.v1.json

scripts/
  build-kmb-fares.mjs       # Build fare data script
  extract-kmb-fares-from-mdb.mjs # MDB extraction script
```

## API Sources

This application uses official Hong Kong government open data APIs:

- **KMB**: [DATA.GOV.HK - KMB ETA](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)
- **MTR**: [DATA.GOV.HK - MTR Next Train](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)
- **Light Rail**: [DATA.GOV.HK - LRT Next Train](https://data.gov.hk/en-data/dataset/mtr-lrt_eta-lrt-eta)

## License

MIT
