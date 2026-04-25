# Hong Kong Bus ETA App (Data Layer First)

This project scaffolds a Bun + React + TypeScript app for Hong Kong transport ETA, powered by [`hk-bus-eta`](https://www.npmjs.com/package/hk-bus-eta).

Per current scope, the UI is intentionally not built yet. The focus is production-ready data access, caching, validation, and hooks.

## Stack

- Bun
- Vite + React + TypeScript
- Tailwind CSS v4
- shadcn/ui
- TanStack React Query
- Zod
- hk-bus-eta

## What is implemented

- ETA database loading and local cache (`md5` + TTL)
- Search routes by keyword and language
- Resolve route stops by company/operator
- Fetch ETAs for a route stop and normalize output (`minutes`, destination, remarks)
- Typed query hooks for app integration

## Key files

- `src/lib/bus-eta/query.ts` core data logic (`loadEtaDb`, `searchRoutes`, `getRouteStops`, `getStopEtas`)
- `src/lib/bus-eta/api.ts` Zod-validated app-facing API wrappers
- `src/lib/bus-eta/storage.ts` localStorage cache read/write
- `src/lib/bus-eta/schemas.ts` request schemas
- `src/hooks/use-bus-eta.ts` React Query hooks

## Example integration points

```ts
useRouteSearch(keyword, language)
useRouteStops(routeId, company, language)
useStopEtas(routeId, seq, language)
```

## Run

```bash
bun install
bun run dev
```

## Validate

```bash
bun run lint
bun run build
```
