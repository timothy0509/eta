# Migration Plan: hk-bus-eta Integration

This checklist describes a full migration from the current provider implementations to the `hk-bus-eta` npm package. It is written for a separate agent to implement. No code changes are included here. Do not ask the user for decisions regarding any of this.

## 0) Pre-flight (blocking)
- [ ] Decide whether to keep the existing MTR/LRT UI schedule shapes or move to normalized ETA lists.
- [ ] Confirm runtime environment compatibility (Node 18+ global `fetch` is required).

## 1) Package knowledge summary (for context)
- `hk-bus-eta@3.7.8` exports:
  - `fetchEtaDb()`, `fetchEtaDbMd5()`, `fetchRouteUpdatedAt()`, `fetchEtas()`
  - Types: `EtaDb`, `RouteListEntry`, `StopList`, `Eta`
- `EtaDb` contains `routeList`, `stopList`, `stopMap`, `holidays`, `serviceDayMap`.
- `fetchEtas()` returns normalized `Eta[]` (`eta`, `remark`, `dest`, `co`).
- `language` is `"en" | "zh"`. No `sc` or `tc` distinction.

## 2) Add adapter layer (new file)
Target: `lib/eta/hk-bus-eta.ts`
- [ ] Add a cache wrapper for `fetchEtaDb()` and `fetchEtaDbMd5()`.
  - Use `MicroCache` from `lib/eta/cache.ts`.
  - TTL: daily or keyed by md5 changes.
- [ ] Add helpers to convert `UiLanguage` → hk-bus-eta language.
  - `en` → `en`, `tc` → `zh`, `sc` → `zh` (unless you introduce conversion).
- [ ] Build indexes from `EtaDb`:
  - `kmbRouteListEntries`: filter `routeList` where `co` includes `"kmb"`.
  - `kmbStops`: map `stopList` to search items (used by stop search UI).
  - `kmbRouteStops`: expand each KMB `RouteListEntry.stops.kmb` into seq entries.
  - `mtrRoutes`, `lrtRoutes`: route entries filtered by `co` containing `"mtr"` or `"lightRail"`.
  - `stationToRouteIndex`: map stopId → route variants (for fast lookups).
- [ ] Expose adapter functions (stable, app-shaped):
  - `getEtaDbCached()`
  - `listKmbStops()`
  - `listKmbRoutes()`
  - `listKmbRouteStops()`
  - `findKmbRouteInfo({route, bound, serviceType})`
  - `fetchKmbEtasForStop({stopId, route?, serviceType?, language})`

## 3) Replace KMB provider implementation
Target: `lib/eta/kmb.ts`
- [ ] Rework `getKmbStops()`:
  - Use adapter `listKmbStops()` built from `EtaDb.stopList`.
  - Provide `name_en`, `name_tc`, `name_sc` fields (map `zh` to `tc`, `sc` fallback to `tc`).
- [ ] Rework `getKmbRouteList()`:
  - Map adapter `listKmbRoutes()` to `KmbRouteListEntry` fields (`orig_*`, `dest_*`, `service_type`, `bound`).
- [ ] Rework `getKmbRouteStops()`:
  - Use adapter `listKmbRouteStops()`; ensure seq is 1-based.
- [ ] Rework `getKmbRouteInfo()`:
  - Resolve by `route + direction + serviceType` from adapter route list.
- [ ] Rework `getKmbStopEta()` and `getKmbEta()`:
  - For each matching route variant:
    - find stop sequence in `RouteListEntry.stops.kmb`.
    - call `fetchEtas({ ...routeEntry, seq, language })`.
  - Map `Eta[]` to `KmbEtaEntry[]`:
    - `route`, `dir` from bound, `service_type`, `seq` (1-based), `eta_seq`, `stop`.
    - `dest_en/tc/sc` from `Eta.dest`, `rmk_*` from `Eta.remark`.
  - Ensure circular route handling still works with existing `computeEtaLeg` logic.

## 4) Update KMB API routes
Targets:
- `app/api/kmb/stops/route.ts`
- `app/api/kmb/routes/route.ts`
- `app/api/kmb/route-stop/route.ts`
- `app/api/kmb/route/route.ts`
- `app/api/kmb/eta/route.ts`
- `app/api/kmb/etas/route.ts`
- `app/api/kmb/stop-etas/route.ts`
- `app/api/kmb/fares/route.ts`

Checklist:
- [ ] Keep the response shapes unchanged (client code depends on them).
- [ ] Use updated `lib/eta/kmb.ts` provider functions (no direct upstream fetches).
- [ ] Review stop-etas fan-out; adjust `KMB_CONCURRENCY` if upstream 429 occurs.
- [ ] Preserve stale fallback behavior in `stop-etas` (still valuable with hk-bus-eta).

## 5) Decide MTR/LRT approach (pick A or B)

### Option A (recommended): normalize UI to `Eta[]`
Targets:
- `lib/eta/mtr.ts`
- `lib/eta/lrt.ts`
- `app/api/mtr/schedules/route.ts`
- `app/api/mtr/schedule/route.ts`
- `app/api/lrt/schedule/route.ts`
- `lib/eta/use-mtr-schedule.ts`
- `lib/eta/use-lrt-schedule.ts`
- `components/eta/results-mtr.tsx`
- `components/eta/results-lrt.tsx`

Checklist:
- [ ] Replace schedule-shaped responses with normalized ETA list responses.
- [ ] Update hooks to request `Eta[]` and store them instead of schedule objects.
- [ ] Update UI to render `Eta[]` list with `eta`, `dest`, `remark`.
- [ ] Ensure `UiLanguage` mapping uses `en/zh` properly.

### Option B: adapt normalized `Eta[]` into schedule shapes
Targets:
- `lib/eta/mtr.ts`
- `lib/eta/lrt.ts`

Checklist:
- [ ] Parse `Eta.remark.en` to derive platform and direction where needed.
- [ ] Compute `ttnt` from timestamp differences for MTR.
- [ ] Populate minimal `MtrScheduleResponse`/`LrtScheduleResponse` with synthesized data.
- [ ] Keep UI unchanged but document lossy mapping risks.

## 6) Client fetch layer updates
Target: `lib/eta/client.ts`
- [ ] Ensure KMB stop/route/route-stop parsing matches new shapes.
- [ ] If Option A: add `fetchMtrEtas`/`fetchLrtEtas` helpers.
- [ ] Keep existing API path names to avoid UI routing changes.

## 7) Caching / rate limiting
- [ ] Add `EtaDb` cache in adapter; verify TTL aligns with daily updates.
- [ ] Keep `kmbDailyCacheControlHeader` behavior in KMB static endpoints.
- [ ] Keep MTR backoff logic if still calling MTR endpoints (or update if using hk-bus-eta only).
- [ ] Re-evaluate concurrency in `stop-etas` with new upstream call patterns.

## 8) Edge cases & data mapping
- [ ] Language: `tc/sc` mapped from `zh`.
- [ ] Stop codes: if no codes in stop names, consider removing stop-code badges or add an external mapping source.
- [ ] Route variants: ensure bounds and serviceType mapping align with existing route-filter UI.
- [ ] Circular route leg computation remains valid with new seq data.

## 9) Verification
- [ ] `bun run lint`
- [ ] `bunx tsc -p tsconfig.json --noEmit`
- [ ] `bun run build`
- [ ] Smoke tests:
  - KMB: stop search, route filter, multi-stop ETA, fare display
  - MTR/LRT: station selection, ETA refresh, error handling

## 10) Rollback plan
- [ ] Keep adapter functions isolated; revert provider functions to old endpoints if regressions occur.
- [ ] If MTR/LRT UI changes are unstable, revert to Option B or original schedule APIs.
