import { NextResponse } from "next/server";
import { z } from "zod";

import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import type { KmbRouteStopLite } from "@/lib/eta/client";
import { kmbFareCacheControlHeader, getCachedKmbVariantStops, getStopToTerminusFare, computeEtaLeg } from "@/lib/eta/kmb-fares";
import { getKmbRouteStops, getKmbStopEta, type KmbEtaEntry } from "@/lib/eta/kmb";
import { promisePool } from "@/lib/eta/promise-pool";
import { kmbStopEtaCache } from "@/lib/eta/cache";

const BodySchema = z.object({
  stopIds: z.array(z.string().trim().min(1)).min(1).max(100),
  routeFilter: z.string().optional(),
  /** When false (default), skip fare computation to speed up response */
  includeFares: z.boolean().optional().default(false),
});

// Concurrency limit for upstream calls
// Vercel latency is often dominated by "fan-out" for multi-stop queries;
// a higher concurrency reduces tail latency while staying conservative.
const KMB_CONCURRENCY = 10;

// Max ETAs per route+direction+leg to return (keep payload small)
const MAX_ETAS_PER_VARIANT = 3;

/** ETA entry augmented with leg info for circular route disambiguation */
export type KmbEtaEntryWithLeg = KmbEtaEntry & {
  /** "A" = departing leg (closer to first stop occurrence), "B" = arriving leg (closer to last stop occurrence), null = not a circular stop */
  leg: "A" | "B" | null;
};

/**
 * POST /api/kmb/stop-etas
 *
 * Fetches ETAs for multiple stops using the upstream Stop ETA API.
 * This is much more efficient than per-route ETA calls.
 *
 * Request body:
 * {
 *   stopIds: string[],      // up to 100 stop IDs
 *   routeFilter?: string    // comma-separated route numbers to filter by
 * }
 *
 * Response:
 * {
 *   byStopId: Record<string, KmbEtaEntry[]>,
 *   errors: string[],       // stop IDs that failed
 *   cached: number,         // count of cache hits
 *   fetched: number         // count of upstream fetches
 * }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: KMB_NO_STORE_HEADERS }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 400, headers: KMB_NO_STORE_HEADERS }
    );
  }

  // Dedupe stop IDs
  const uniqueStopIds = Array.from(new Set(parsed.data.stopIds)).slice(0, 100);

  // Parse route filter
  const routeFilterSet = parsed.data.routeFilter
    ? new Set(
        parsed.data.routeFilter
          .split(",")
          .map((r) => r.trim().toUpperCase())
          .filter(Boolean)
      )
    : null;

  try {
    // Load variant stops first - needed for leg computation
    const byVariantStops = await getCachedKmbVariantStops(async () => {
      const routeStops = await getKmbRouteStops();
      const lite: KmbRouteStopLite[] = routeStops
        .map((entry) => ({
          route: entry.route,
          bound: entry.bound,
          serviceType: String(entry.service_type),
          seq: typeof entry.seq === "string" ? Number(entry.seq) : entry.seq,
          stopId: entry.stop,
        }))
        .filter((entry) => entry.route && entry.stopId);
      return lite;
    });

    const byStopId: Record<string, KmbEtaEntryWithLeg[]> = {};
    const errors: string[] = [];
    let cached = 0;
    let fetched = 0;

    const results = await promisePool(uniqueStopIds, KMB_CONCURRENCY, async (stopId) => {
      const cacheKey = `stop-eta:${stopId}`;

      // Try cache first
      const cachedData = kmbStopEtaCache.get(cacheKey) as KmbEtaEntry[] | undefined;
      if (cachedData !== undefined) {
        cached++;
        return { stopId, eta: cachedData, fromCache: true };
      }

      // Fetch from upstream (deduped per stopId)
      const eta = (await kmbStopEtaCache.getOrFetch(
        cacheKey,
        () => getKmbStopEta(stopId)
      )) as KmbEtaEntry[];
      fetched++;
      return { stopId, eta, fromCache: false };
    });

    for (const result of results) {
      if (result.status === "rejected") {
        // Find which stopId failed (by index)
        const idx = results.indexOf(result);
        if (idx >= 0 && uniqueStopIds[idx]) {
          errors.push(uniqueStopIds[idx]);
        }
        continue;
      }

      const { stopId, eta } = result.value;

      // Apply route filter if provided
      let filtered: KmbEtaEntry[] = eta;
      if (routeFilterSet && routeFilterSet.size > 0) {
        filtered = eta.filter((entry: KmbEtaEntry) =>
          routeFilterSet.has((entry.route ?? "").toUpperCase())
        );
      }

      // Add leg info to each entry and group by route+dir+service_type+leg
      // This prevents circular routes from mixing departing/arriving ETAs
      const byVariant = new Map<string, KmbEtaEntryWithLeg[]>();
      for (const entry of filtered) {
        const route = String(entry.route ?? "").toUpperCase();
        const dir = String(entry.dir ?? "");
        const serviceType = String(entry.service_type ?? "");
        
        // Compute leg for circular route disambiguation
        const leg = computeEtaLeg({
          route,
          dir,
          serviceType,
          stopId,
          etaSeq: entry.seq,
          byVariantStops,
        });

        // Include leg in grouping key to separate departing/arriving ETAs
        const legSuffix = leg ?? "_";
        const key = `${route}|${dir}|${serviceType}|${legSuffix}`;
        
        const existing = byVariant.get(key) ?? [];
        if (existing.length < MAX_ETAS_PER_VARIANT) {
          existing.push({ ...entry, leg });
          byVariant.set(key, existing);
        }
      }

       // Flatten back to array, sorted by route
       const trimmed = Array.from(byVariant.values())
         .flat()
         .map((entry) => ({
           ...entry,
           stop: stopId,
         }))
         .sort((a, b) => {
           const routeCmp = (a.route ?? "").localeCompare(b.route ?? "", undefined, { numeric: true });
           if (routeCmp !== 0) return routeCmp;
           return (a.eta_seq ?? 0) - (b.eta_seq ?? 0);
         });

       byStopId[stopId] = trimmed;

    }

    // Compute fares per route variant (route|dir|service_type) - base key without leg
    // Only compute if includeFares is true (deferred by default for faster initial load)
    let faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: "td-fare" }> | undefined;

    if (parsed.data.includeFares) {
      faresByVariantKey = {};
      for (const [stopId, entries] of Object.entries(byStopId)) {
        for (const entry of entries) {
          const route = String(entry.route ?? "").toUpperCase();
          const dir = String(entry.dir ?? "");
          const serviceType = String(entry.service_type ?? "");
          const vKey = `${route}|${dir}|${serviceType}`;

          if (faresByVariantKey[vKey]) continue;

          const destCandidates = [entry.dest_en, entry.dest_tc, entry.dest_sc].filter(Boolean).map(String);
          const fare = getStopToTerminusFare({
            route,
            dir,
            serviceType,
            stopId,
            etaDestCandidates: destCandidates,
            byVariantStops,
          });

          if (fare) {
            faresByVariantKey[vKey] = fare;
          }
        }
      }
    }

    return NextResponse.json(
      {
        byStopId,
        faresByVariantKey,
        errors,
        cached,
        fetched,
      },
      {
        headers: {
          ...KMB_NO_STORE_HEADERS,
          // This response includes ETA (no-store), but fare mapping is derived from daily-cached data.
          // Keep no-store to avoid stale ETAs; consumers can still use faresByVariantKey if present.
          "X-KMB-Fare-Cache": kmbFareCacheControlHeader(),
        },
      }
    );
  } catch (error) {
    console.error("/api/kmb/stop-etas failed", error);

    const status =
      error instanceof UpstreamTimeoutError
        ? 504
        : error instanceof ApiError
          ? 502
          : 500;

    return NextResponse.json(
      { error: "Failed to load KMB stop ETAs" },
      { status, headers: KMB_NO_STORE_HEADERS }
    );
  }
}
