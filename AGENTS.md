# AGENTS.md

This repo is TimoETA, a Hong Kong transit ETA web app. Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Zustand, Vitest.

## Commands

Package manager is bun (`bun.lock` checked in). npm works but bun is preferred. Node 22 in CI, `.nvmrc` pins 22.

```bash
bun install
bun run dev      # next dev, http://localhost:3000
bun run build    # next build
bun run start    # next start
bun run lint     # eslint, no --fix
bun run test     # vitest run, single pass
bun run test:watch    # vitest watch mode
bun run test:coverage # vitest run --coverage
bun run format        # prettier --write .
bun run format:check  # prettier --check .
ANALYZE=true bun run build # bundle analyzer, closed by default
```

CI (`.github/workflows/ci.yml`) runs lint, test, then build on push to main and on PRs. Husky runs `lint-staged` on pre-commit and `bun run lint` plus `bun run test` on pre-push.

## Verify before you finish

Run these before your turn ends. Do not skip a step because an earlier one passed.

```bash
bun run lint
bunx tsc --noEmit
bun run test
bun run build
```

- Run `bun run format` first if you touched styling or imports, then re-run lint.
- `bunx tsc --noEmit` is the typecheck. There is no `typecheck` script, call `tsc` directly. Fix every error, no `@ts-expect-error` or `any` to silence it.
- `bun run test` must pass. If you changed fetch, cache, or URL state, the adjacent test file must cover it.
- `bun run build` must pass for any code change. Docs-only edits can skip it, state that in your summary.
- If any step fails, fix it and rerun the full sequence. Report the four results at the end.
- A green build does not mean a push will succeed. `git push` runs `.husky/pre-push`
  (`bun run lint` plus `bun run test`), so the gate that matters for pushing is lint plus test.
- If the turn is expected to be pushed, verify the push path before ending:
  `git push --dry-run -u origin HEAD`. A dry run still executes the pre-push hook, so it proves
  the push is not blocked. New branches have no upstream, so plain `git push` fails before the
  hook even runs.
- Never end a turn with a red check written off as pre-existing. Stash your changes and rerun the
  failing step on the clean tree. If it fails there too, state that explicitly and either fix it or
  ask for direction. Do not push with `--no-verify` to get past a red gate.
- This sandbox may run a different Node major than `.nvmrc` pins (22). If the suite fails here with
  environment errors such as missing `localStorage` under jsdom, confirm against the pinned Node
  before blaming your change.

## Layout

```text
app/                 # App Router: page.tsx, layout.tsx, home-client.tsx, error/loading/not-found, robots, sitemap
components/eta/      # Feature UI: panes/, views/, results-*.tsx, search, filters, favorites, app-shell
components/eta/panes/  # kmb-pane, mtr-pane, lrt-pane plus kmb hooks and reducer
components/eta/views/  # routes, nearby, settings views
components/m3/       # Small motion/search primitives
components/ui/       # shadcn/ui only, do not hand-edit styling patterns here
lib/eta/             # All domain logic: direct/, cache/, providers, hooks, utils
lib/eta/direct/      # Upstream clients: kmb.ts, mtr.ts, lrt.ts, eta-db.ts, osrm.ts, shared.ts
lib/eta/cache/       # micro-cache.ts, policy.ts, keys.ts, idb.ts
lib/store.ts         # Global Zustand store, persisted favorites/recents/settings
lib/eta/pane-store.ts # Per-pane transient UI state, not persisted
lib/data/            # Static MTR and LRT station lists
lib/env.ts           # NEXT_PUBLIC_SITE_URL with fallback to https://eta.hkjc.uk
```

Tests live next to source as `*.test.ts`, matched by `**/*.{test,spec}.{ts,tsx}` in `vitest.config.mts`. Coverage includes `lib/**` and `app/**`.

## Conventions

### Imports and paths

- Path alias is `@/*` for repo root (`tsconfig.json`). Always import with `@/`, never with relative `../../` across feature boundaries.
- `optimizePackageImports` in `next.config.ts` covers lucide-react, framer-motion, radix packages, cmdk, sonner, zustand, leaflet, fuse.js. Import from package roots, no deep imports.
- `sort-imports` eslint rule is off. Group order used in this repo is React/Next, third party, then `@/` imports. Follow that.

### TypeScript and React

- `strict: true`, `noEmit`, `jsx: react-jsx`. Do not use `any`, eslint errors on `@typescript-eslint/no-explicit-any`. Use `unknown` plus narrowing.
- Unused vars starting with `_` are allowed. Everything else warns.
- Client components need `'use client'` at the top. Check existing files: hooks, panes, results, store consumers all carry it. Server components stay in `app/` shell (`page.tsx`, `layout.tsx`).
- React Compiler is on (`reactCompiler: true`). Do not hand-memoize what the compiler handles unless a file opts out. Keep existing explicit `useMemo`/`useCallback` where request identity matters (abort controllers, dedupe keys, schedules).
- Heavy panes and results load with `next/dynamic` plus `ssr: false` in `home-client.tsx`. Keep that pattern when adding a heavy view. Provide `PaneSkeleton` or `ResultsSkeleton` as loading fallback.

### Styling

- Tailwind v4 (`@import 'tailwindcss'` in `app/globals.css`), shadcn style `new-york`, base color neutral, CSS variables on. Use `cn()` from `@/lib/utils` for class merges.
- Prettier: no semicolons, single quotes, `printWidth: 100`, `tailwindcss` plugin last. Run `bun run format` before pushing. `.prettierignore` skips build output and lockfiles.
- Fonts: Inter plus Noto Sans HK/SC via `next/font`, Geist Mono via `@fontsource`. Theme via `next-themes` with `attribute="class"`.

### State

- `lib/store.ts` is the persisted global store (mode, subView, lang, favorites, recents, groups, auto-refresh seconds, route filter mode). Persistence uses a 300 ms debounced localStorage wrapper with `beforeunload` flush. Keep field names backward compatible, old favorites still decode.
- `lib/eta/pane-store.ts` is transient per-pane state. Put anything that should not survive reload there.
- URL is the shareable state. `lib/eta/url-state.ts` owns `encodeUrlState` and `decodeUrlState`. DEFAULTS are mode kmb, subView stops, lang tc, route filter simple, refresh 15s. Valid refresh values are 0, 10, 15, 30, 60. Any new persisted or URL-visible state must round-trip through these functions and keep old links working.

### Data layer

- No API routes. All transit fetches run client-side through `lib/eta/client.ts` and `lib/eta/direct/*`.
- Source of truth is the `hk-bus-eta` npm package plus direct upstream JSON: `data.etabus.gov.hk`, `opendata.mtr.com.hk`, `www.lrtetas.hk`, plus `rt.data.gov.hk`, `data.etagmb.gov.hk`, `data.hkbus.app`, `hkbus.github.io`, `router.project-osrm.org` for routing. If you add a host, add it to `connect-src` in `next.config.ts` CSP or the browser blocks it.
- `client.ts` dedupes in-flight requests by normalized key (sorted routes, sorted stop ids, normalized fare variant). Reuse `fetchJsonDedupe` for new fetchers, do not add parallel fetch helpers.
- `lib/eta/http.ts` owns `fetchJson` with 12 s default timeout, `ApiError` with status, `UpstreamTimeoutError`, and HTML-body sanitizing. New HTTP code goes through it.
- Caching is `MicroCache` with TTL in `lib/eta/cache/micro-cache.ts`, key builders in `keys.ts`, policy in `policy.ts`, IndexedDB persistence in `idb.ts` for the ETA db. Respect TTLs, do not bypass the cache for freshness.
- Stale thresholds live in `lib/eta/stale.ts`: kmb 60 s, mtr 90 s, lrt 90 s. ETA minute math lives in `lib/eta/format.ts` including drift correction. Reuse these instead of inline date math.
- MTR fetches use batched requests with 429 backoff. Keep backoff when touching `direct/mtr.ts`.

### i18n

- UI languages are `en`, `tc`, `sc` (`UiLanguage` in `lib/eta/types.ts`). Central dictionary is `lib/eta/i18n.ts`.
- KMB supports all three. MTR and LRT support en and tc only. `isLanguageSupported` guards this. Default language for every mode is `tc`. New strings need all three entries where KMB shows them, en plus tc elsewhere.

### Search and display

- KMB stop search uses Fuse.js fuzzy match plus infinite scroll (`use-infinite-scroll.ts`). Same-name sequential stops group together. Route badges color by type in `lib/eta/route-badge.ts`, line colors in `lib/eta/line-colors.ts`. Keep badge and color logic in those files, not in components.

## Tests

- Runner is Vitest with jsdom, alias `@` mapped to root, React plugin on. Shared render helpers live in `lib/test-utils.tsx`.
- Existing coverage pattern: pure logic units for format, geo, http, promise-pool, routing, stale, micro-cache, url-state, osrm, eta-db-stop-etas, kmb route filter. Follow that, put tests next to the module.
- Run `bun run test` before pushing. Husky pre-push already does this plus lint. If a change touches fetch, cache, or URL state, add or update the adjacent test file.

## Security and metadata

- `next.config.ts` sets HSTS, nosniff, DENY framing, strict referrer, limited permissions policy, and a tight CSP. `images.formats` is webp/avif, `compress: true`.
- `app/layout.tsx` owns metadata, canonical URL from `lib/env.ts`, OpenGraph/Twitter, JSON-LD, and preconnect/dns-prefetch for the three main upstream hosts. Keep preconnect in sync with fetch hosts.

## What to avoid

- No new API routes or server proxies without a stated reason. The direct client fetch design is deliberate.
- No new global state outside `lib/store.ts` and `lib/eta/pane-store.ts`.
- No hardcoded transit URLs in components. Put them in `lib/eta/direct/*` or `shared.ts`.
- No `any`, no unused exports, no untranslated UI strings, no new connect hosts without a CSP update.
- Do not edit `components/ui/*` styling conventions away from shadcn/new-york. Build feature UI in `components/eta/`.
