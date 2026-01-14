# AGENTS.md (Repo Guidance for Coding Agents)

This repository is a **Next.js 16 App Router** application written in **TypeScript** (React 19) with Tailwind CSS v4 and Zustand.

No Cursor (`.cursor/rules/`, `.cursorrules`) or Copilot (`.github/copilot-instructions.md`) rule files were found in this repo at time of writing.

## Quick Context

- App router lives in `app/` (including API routes under `app/api/**/route.ts`).
- Shared libraries live in `lib/` (notably `lib/eta/*` for upstream transit fetching, caching, and formatting).
- UI components live in `components/` (including shadcn/ui under `components/ui/`).
- Path alias `@/*` maps to repo root (see `tsconfig.json`).

## Setup

Preferred package manager is **bun** (repo has `bun.lock`), but npm works (`package-lock.json` is present).

- Install deps (bun): `bun install`
- Install deps (npm): `npm install`

Node.js 18+ is recommended.

## Build / Lint / Test Commands

### Development

- Dev server: `bun run dev` (or `npm run dev`)
- Production build: `bun run build` (or `npm run build`)
- Start prod server: `bun start` (or `npm start`)

### Lint

- Run ESLint: `bun run lint` (or `npm run lint`)
  - ESLint config: `eslint.config.mjs` (Next.js core-web-vitals + TypeScript presets)

### Typecheck

There is no dedicated `typecheck` script, but TypeScript is configured with `noEmit`.

- Typecheck: `bunx tsc -p tsconfig.json --noEmit` (or `npx tsc -p tsconfig.json --noEmit`)

### Tests

This repo currently contains **no unit/integration test runner config** (no Jest/Vitest/Playwright configs and no `*.test.*`/`*.spec.*` files were found).

Recommended “single-test” equivalents:

- Run a focused typecheck on a single file (fast feedback):
  - `bunx tsc --noEmit --pretty false --incremental false path/to/file.ts`
- Run ESLint on a single file:
  - `bunx eslint path/to/file.ts` (or `npx eslint path/to/file.ts`)

If you add a test framework in the future, also add:

- `npm run test` / `bun run test`
- `npm run test -- path/to/test` (single test file)

## Data / Scripts

Fare data is tracked via Git LFS under `data/fare/`.

- Build fare index: `bun run fare:build` (or `npm run fare:build`)
- Extract fares from MDB: `bun run fare:extract` (or `npm run fare:extract`)

## Code Style (TypeScript / React / Next.js)

### TypeScript strictness

`tsconfig.json` has `strict: true`. Prefer explicit, narrow types.

- Prefer `unknown` over `any` for untrusted input.
- Use Zod for request parsing/validation in API routes (pattern used in `app/api/**/route.ts`).

### Imports

Follow this general ordering (matches existing files):

1. Framework imports (e.g. `next/server`, `react`)
2. Third-party libs (e.g. `zod`, `zustand`)
3. Internal imports via alias `@/…`

Guidelines:

- Use type-only imports where appropriate: `import type { Foo } from "…";`
- Prefer `@/…` for internal imports instead of deep relative paths.
- Keep imports sorted/grouped; avoid circular dependencies across `lib/eta/*`.

### Formatting

No Prettier/Biome config exists; formatting is implicitly enforced via ESLint/Next defaults.

- Match surrounding file’s style.
- Use 2 spaces for indentation.
- Prefer semicolons where the file uses them.
  - Note: some shadcn/ui files omit semicolons; don’t “normalize” unrelated files.

### Naming conventions

- Files: kebab-case (already used widely, e.g. `use-mtr-schedule.ts`).
- Types: `PascalCase` (`MtrScheduleResponse`).
- Values/functions: `camelCase` (`fetchJson`, `promisePool`).
- Constants: `SCREAMING_SNAKE_CASE` for module-level constants.
- React components: `PascalCase`.

### React / Next.js App Router rules

- Client components must start with the directive at the top:
  - `"use client";`
- Server code (API routes) must stay compatible with Next.js runtime.
- Prefer colocating API route logic in `lib/eta/*` when reusable by multiple routes.

### Tailwind / classnames

- Use `cn()` from `lib/utils.ts` for className composition.
- Avoid manual string concatenation for class names.

### State management (Zustand)

- Store is `useAppStore` in `lib/store.ts` with `persist` middleware.
- Keep persisted state minimal via `partialize`.
- When adding to store, ensure backwards compatibility for persisted fields.

## API Route Patterns (Error handling, validation)

API routes under `app/api/**/route.ts` generally follow these rules:

- Parse JSON safely:
  - Wrap `await request.json()` in try/catch and return `{ status: 400 }` on invalid JSON.
- Validate with Zod using `safeParse`.
  - Return `{ status: 400 }` with validation details.
- Use typed upstream client helpers in `lib/eta/*`.
- Error mapping:
  - `UpstreamTimeoutError` -> 504
  - `ApiError` -> 502 by default; preserve 429 when relevant
  - Unknown errors -> 500

Do not leak upstream HTML/error pages to clients; upstream fetch helper already sanitizes body text (`lib/eta/http.ts`).

## Caching / Rate limiting conventions

- Prefer existing micro-caches in `lib/eta/cache.ts`.
- For rate-limited providers (e.g. MTR), follow existing patterns:
  - concurrency limits (`promisePool`)
  - backoff on 429
  - request de-duplication

## Making Changes Safely

- Keep changes minimal and localized.
- Avoid reformat-only diffs, especially in `components/ui/*`.
- When changing API behavior, ensure status codes and error shapes remain stable.
- Update scripts and data generation (`scripts/*.mjs`) only when needed; be mindful of Git LFS data.

## Suggested Verification Checklist (No tests yet)

When you change code, prefer this order:

1. `bun run lint`
2. `bunx tsc -p tsconfig.json --noEmit`
3. `bun run build` (catches Next.js/server-side issues)
4. Smoke run: `bun run dev` and hit relevant pages/routes
