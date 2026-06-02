# Agent Instructions — TimoETA

Hong Kong transit ETA web app. Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + shadcn/ui.

## Prerequisites

- **Node.js 22** (`.nvmrc`)
- **Bun** preferred (CI, pre-commit, pre-push all use `bun`). npm/yarn/pnpm also work.

## Commands

| Task | Command |
|------|---------|
| Dev server | `bun run dev` → http://localhost:3000 |
| Build | `bun run build` |
| Lint | `bun run lint` |
| Format | `bun run format` |
| Test | `bun run test` |
| Test watch | `bun run test:watch` |
| Test coverage | `bun run test:coverage` |
| Bundle analyze | `bun run analyze` |

**CI order**: `lint` → `test` → `build` (GitHub Actions enforces this). Build job uses `NODE_OPTIONS=--max-old-space-size=5120`; local build uses `2048`.

## Git Hooks

- **Pre-commit**: `bunx lint-staged` → `eslint --fix` + `prettier --write` on staged files.
- **Pre-push**: `bun run lint && bun run test`.

## Architecture

- **Single-page app**: `app/page.tsx` → `app/home-client.tsx`. All transport modes (KMB/MTR/LRT) rendered client-side in one page.
- **No API routes**: All transit API calls are direct client-side fetches (`lib/eta/direct/`). No `app/api/` routes.
- **Lazy-loaded panes**: Transport mode components are `dynamic()` imports with `ssr: false` to reduce initial bundle.
- **State**: Zustand (`lib/store.ts`) with `localStorage` persistence.
- **Data source**: [`hk-bus-eta`](https://github.com/hkbus/hk-bus-eta) npm package provides routes, stops, ETAs, and fares. No local static data extraction needed.
- **Caching**: In-memory `MicroCache` with TTL + IndexedDB persistence for the ETA database (`lib/eta/cache/`).

## Key Directories

| Directory | Purpose |
|-----------|---------|
| `app/` | Next.js App Router pages and layout |
| `components/eta/` | Main application components (panes, results, search, favorites) |
| `components/ui/` | shadcn/ui components (do not edit shadcn internals; use `cva` + `cn` patterns) |
| `lib/eta/` | Transit data logic: direct fetch clients, caching, formatting, URL state |
| `lib/data/` | Static station definitions (`mtr-stations.ts`, `lrt-stations.ts`) |
| `lib/hooks/` | Custom React hooks |

## Toolchain Quirks

- **Tailwind v4**: Config lives in `app/globals.css` via `@theme inline` and `@import 'tailwindcss'`. No `tailwind.config.js`.
- **PostCSS**: Uses `@tailwindcss/postcss` plugin (`postcss.config.mjs`).
- **Path alias**: `@/*` maps to `./*` (root-relative).
- **TypeScript**: `moduleResolution: bundler`, `jsx: react-jsx`.
- **Prettier**: No semicolons, single quotes, trailing comma `es5`, `printWidth: 100`.
- **ESLint**: `@typescript-eslint/no-explicit-any` is `error`. Unused vars with `_` prefix are ignored.

## Environment Variables

- `NEXT_PUBLIC_SITE_URL` — optional, defaults to `https://eta.hkjc.uk`.
- Validated at **runtime only** (not during build). `lib/env.ts` checks `NEXT_RUNTIME` to avoid throwing at build time.

## Testing

- **Vitest** with `jsdom` environment. React Testing Library + `@vitejs/plugin-react`.
- Test files: `**/*.{test,spec}.{ts,tsx}` (mostly in `lib/`).
- Coverage includes `lib/**` and `app/**`.
- Store tests (`lib/store.test.ts`) create a test Zustand store **without** the `persist` middleware.

## Build & Memory

- `next.config.ts` limits workers to `cpus: 4` and disables `reactCompiler` to keep memory under ~2GB.
- If build OOMs locally, raise `--max-old-space-size` or use the CI value (`5120`).

## Style & Conventions

- **No semicolons** in JS/TS.
- Use `cn()` from `lib/utils.ts` for conditional class merging.
- Prefer dynamic imports with `ssr: false` for heavy client-only components.
- Keep shadcn/ui components in `components/ui/`; extend via `cva` in consuming components rather than editing the base component.
- `globals.css` contains custom animation utilities (`ui-animate-in`, `ui-lift`, etc.) and motion primitives under `@layer utilities`.

## External APIs (CSP allowlist)

- `https://data.etabus.gov.hk` — KMB
- `https://opendata.mtr.com.hk` — MTR
- `https://www.lrtetas.hk` — Light Rail

## Useful References

- `README.md` — Full project description and feature list.
- `USER_GUIDE.md` — End-user documentation.
- `components.json` — shadcn/ui configuration (style: new-york, iconLibrary: lucide).
