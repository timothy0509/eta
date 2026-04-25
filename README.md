# HK Bus ETA

Real-time Hong Kong bus arrival app, powered by [`hk-bus-eta`](https://www.npmjs.com/package/hk-bus-eta).

## Stack

- Next.js 16 App Router (TypeScript)
- Bun runtime and package manager
- Tailwind CSS v4
- shadcn/ui components
- Framer Motion animations
- `hk-bus-eta` for route + ETA data
- `zod` for API validation

## Quick start

```bash
bun install
bun run dev
```

Server starts at `http://localhost:3000`.

## Features

### Web UI

- **Search** — Fuzzy search by route number, origin, or destination
- **Operator filter** — Filter by KMB, Citybus, NLB, GMB, or LRT feeder
- **Route detail** — Stop list with real-time ETA per stop
- **Auto-refresh** — ETA updates every 15 seconds
- **Bilingual** — English and Traditional Chinese support
- **Mobile-first** — Responsive design optimized for commuters

### API endpoints

All endpoints return JSON with `{ ok: true, data: ... }` on success, and `{ ok: false, error: ... }` on failure.

#### Health

`GET /api/health`

Returns service status and ETA database cache status.

#### Operators

`GET /api/operators`

Returns supported bus operators:

- `kmb`
- `ctb`
- `nlb`
- `gmb`
- `lrtfeeder`

#### Routes search

`GET /api/routes?query=&operator=&limit=`

Query params:

- `query` (optional): fuzzy text match on route ID, route number, origin, destination
- `operator` (optional): one of `kmb|ctb|nlb|gmb|lrtfeeder`
- `limit` (optional): integer `1..100`, default `20`

#### Route stops

`GET /api/routes/:routeId/stops?operator=`

Query params:

- `operator` (required): one of `kmb|ctb|nlb|gmb|lrtfeeder`

#### ETA lookup

`GET /api/eta?routeId=&operator=&seq=&lang=`

Query params:

- `routeId` (required)
- `operator` (required): one of `kmb|ctb|nlb|gmb|lrtfeeder`
- `seq` (required): stop sequence index starting from `0`
- `lang` (optional): `en|zh`, default `en`

#### OpenAPI metadata

`GET /api/openapi`

Returns a compact OpenAPI 3.1 schema for the above endpoints.

## Example requests

```bash
curl "http://localhost:3000/api/operators"
curl "http://localhost:3000/api/routes?query=1&operator=kmb&limit=5"
curl "http://localhost:3000/api/routes/1%2B1%2BCHUK%20YUEN%20ESTATE%2BSTAR%20FERRY/stops?operator=kmb"
curl "http://localhost:3000/api/eta?routeId=1%2B1%2BCHUK%20YUEN%20ESTATE%2BSTAR%20FERRY&operator=kmb&seq=0&lang=en"
```

## Development scripts

- `bun run dev` - start development server
- `bun run build` - production build
- `bun run start` - start production server
- `bun run lint` - run ESLint
- `bun run typecheck` - run TypeScript checks
- `bun run test` - run tests

## Design system

- **Style**: Flat design with real-time monitoring accents
- **Colors**: Transit blue (#2563EB), cyan (#0891B2), orange accent (#EA580C)
- **Typography**: Noto Serif TC (headings), Noto Sans TC (body)
- **Animations**: Staggered list reveals, pulsing live indicators, smooth transitions (150-200ms)

## Caching model

- ETA DB cache: in-memory, 30 minute TTL
- ETA DB freshness check: MD5 check every 5 minutes
- ETA response cache: in-memory, 15 second TTL

## Convex usage

Convex is not used yet. Current version is single-instance, in-process caching.

If you need shared cache across instances, favorites/history, or analytics, Convex can be added in the next phase.

## License note

`hk-bus-eta` is licensed under GPL-3.0-only. Review license compatibility before distributing proprietary builds.
