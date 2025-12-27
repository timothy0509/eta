# TimoETA

A clean, fast ETA (Estimated Time of Arrival) web application for Hong Kong public transit. Get real-time arrival information for KMB buses, MTR trains, and Light Rail.

## Features

- **KMB Bus ETAs** - Real-time arrival times for all KMB bus routes
  - Search stops by name or code
  - Group stops with the same name (e.g., stops on opposite sides of a road)
  - Filter by specific routes (simple comma-separated or advanced multi-select)
  - Color-coded route badges by type (Airport, Overnight, Cross-harbour, etc.)

- **MTR Next Train** - Arrival times for all MTR lines
  - Search stations by name
  - View arrivals for all lines serving a station
  - Color-coded line indicators

- **Light Rail Schedule** - Real-time arrivals for LRT
  - Search stations by name
  - View platform-specific arrivals

- **General Features**
  - Auto-refresh (configurable: 10s, 15s, 30s, 60s, or off)
  - Favorites and Recent searches
  - Multi-language support (English, Traditional Chinese, Simplified Chinese for KMB)
  - Dark/Light theme
  - Responsive design for mobile and desktop

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Styling**: Tailwind CSS v4 + shadcn/ui components
- **State Management**: Zustand (persisted to localStorage)
- **Language**: TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- npm, yarn, pnpm, or bun

### Installation

```bash
# Clone the repository
git clone https://github.com/your-username/eta.git
cd eta

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build for Production

```bash
npm run build
npm start
```

## Project Structure

```
app/
  api/
    kmb/          # KMB API proxies (eta, route, route-stop, stops)
    lrt/          # LRT schedule API proxy
    mtr/          # MTR schedule API proxy
  page.tsx        # Main application page
  layout.tsx      # Root layout with theme provider
  globals.css     # Global styles and Tailwind config

components/
  eta/            # Feature components
    auto-refresh.tsx      # Auto-refresh menu
    favorites.tsx         # Favorites and Recent searches panel
    language-toggle.tsx   # Language selector
    lrt-stop-search.tsx   # LRT station search
    mode-tabs.tsx         # KMB/MTR/LRT tab switcher
    results-kmb.tsx       # KMB ETA results display
    results-lrt.tsx       # LRT schedule display
    results-mtr.tsx       # MTR schedule display
    route-badge.tsx       # Color-coded route badge component
    route-filter.tsx      # Route filter (simple/advanced modes)
    station-search.tsx    # MTR station search
    stop-search.tsx       # KMB stop search
  ui/             # shadcn/ui components

lib/
  data/
    lrt-stations.ts   # LRT station definitions
    mtr-stations.ts   # MTR station definitions
  eta/
    client.ts         # API client functions
    format.ts         # ETA formatting utilities
    http.ts           # HTTP utilities
    kmb.ts            # KMB types and utilities
    line-colors.ts    # MTR/LRT line color mappings
    lrt.ts            # LRT types
    mtr.ts            # MTR types
    route-badge.ts    # Route badge color logic
    types.ts          # Shared types
    use-auto-refresh.ts  # Auto-refresh hook
  store.ts          # Zustand store (favorites, settings)
  utils.ts          # General utilities
```

## API Sources

This application uses official Hong Kong government open data APIs:

- **KMB**: [DATA.GOV.HK - KMB ETA](https://data.gov.hk/en-data/dataset/hk-td-tis_21-etakmb)
- **MTR**: [DATA.GOV.HK - MTR Next Train](https://data.gov.hk/en-data/dataset/mtr-data2-nexttrain-data)
- **Light Rail**: [DATA.GOV.HK - LRT Next Train](https://data.gov.hk/en-data/dataset/mtr-lrt_eta-lrt-eta)

## License

MIT
