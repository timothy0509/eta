import { kmbStopEtaCache } from "@/lib/eta/cache";
import type { KmbRouteStopLite } from "@/lib/eta/client";
import { fetchKmbEtasForStop, listKmbRouteStops } from "@/lib/eta/hk-bus-eta";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import {
  computeEtaLeg,
  getCachedKmbVariantStops,
  getStopToTerminusFare,
  kmbFareCacheControlHeader,
} from "@/lib/eta/kmb-fares";
import { promisePool } from "@/lib/eta/promise-pool";
import { NextResponse } from "next/server";
import { z } from "zod";

const KMB_MAX_STALE_AGE_MS = 30_000;

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
export type KmbEtaEntryWithLeg = {
  co: string;
  route: string;
  dir: "I" | "O" | string;
  service_type: number | string;
  seq: number;
  stop: string;
  dest_en: string;
  dest_tc: string;
  dest_sc: string;
  eta_seq: number;
  eta: string;
  rmk_en: string;
  rmk_tc: string;
  rmk_sc: string;
  data_timestamp: string;
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
 *   byStopId: Record<string, KmbEtaEntryWithLeg[]>,
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
      const routeStops = await listKmbRouteStops();
      const lite: KmbRouteStopLite[] = routeStops
        .map((entry) => ({
          co: entry.co,
          route: entry.route,
          bound: entry.bound,
          serviceType: String(entry.serviceType),
          seq: entry.seq,
          stopId: entry.stopId,
        }))
        .filter((entry) => entry.route && entry.stopId);
      return lite;
    });

    const byStopId: Record<string, KmbEtaEntryWithLeg[]> = {};
    const errors: string[] = [];
    const staleByStopId: Record<string, { stale: boolean; ageMs: number | null }> = {};
    let cached = 0;
    let fetched = 0;
    let staleServed = 0;

    const results = await promisePool(uniqueStopIds, KMB_CONCURRENCY, async (stopId) => {
      const cacheKey = `stop-eta:${stopId}`;

      // Try fresh cache first
      const cachedData = kmbStopEtaCache.get(cacheKey) as KmbEtaEntryWithLeg[] | undefined;
      if (cachedData !== undefined) {
        cached++;
        staleByStopId[stopId] = { stale: false, ageMs: 0 };
        return { stopId, eta: cachedData, fromCache: true };
      }

      // Fetch from upstream (deduped per stopId). If it fails, fall back to stale.
      try {
        const eta = (await kmbStopEtaCache.getOrFetch(cacheKey, async () => {
          const results = await fetchKmbEtasForStop({ stopId, language: "tc" });
          const now = new Date().toISOString();
          return results.map((entry, idx) => ({
            co: entry.co ?? "kmb",
            route: entry.route,
            dir: entry.dir,
            service_type: entry.serviceType,
            seq: entry.seq,
            stop: stopId,
            dest_en: entry.dest?.en ?? "",
            dest_tc: entry.dest?.zh ?? "",
            dest_sc: entry.dest?.zh ?? "",
            eta_seq: entry.etaSeq ?? idx + 1,
            eta: entry.eta ?? "",
            rmk_en: entry.remark?.en ?? "",
            rmk_tc: entry.remark?.zh ?? "",
            rmk_sc: entry.remark?.zh ?? "",
            data_timestamp: now,
            leg: null,
          }));
        })) as KmbEtaEntryWithLeg[];
        fetched++;
        staleByStopId[stopId] = { stale: false, ageMs: 0 };
        return { stopId, eta, fromCache: false };
      } catch (error) {
        const stale = kmbStopEtaCache.getStale(
          cacheKey,
          KMB_MAX_STALE_AGE_MS
        ) as { value: KmbEtaEntryWithLeg[]; meta: { createdAt: number } } | undefined;

        if (stale) {
          staleServed++;
          staleByStopId[stopId] = {
            stale: true,
            ageMs: Date.now() - stale.meta.createdAt,
          };
          return { stopId, eta: stale.value, fromCache: true };
        }

        throw error;
      }

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
      let filtered: KmbEtaEntryWithLeg[] = eta;
      if (routeFilterSet && routeFilterSet.size > 0) {
        filtered = eta.filter((entry) =>
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
        const co = String(entry.co ?? "kmb");

        // Compute leg for circular route disambiguation
        const etaSeq = entry.seq;
        const leg = computeEtaLeg({
          co,
          route,
          dir,
          serviceType,
          stopId,
          etaSeq,
          byVariantStops,
        });

        // Include leg in grouping key to separate departing/arriving ETAs
        const legSuffix = leg ?? "_";
        const key = `${co}|${route}|${dir}|${serviceType}|${legSuffix}`;

        const existing = byVariant.get(key) ?? [];
        if (existing.length < MAX_ETAS_PER_VARIANT) {
          existing.push({
            ...entry,
            eta_seq: entry.eta_seq ?? entry.seq,
            leg,
          });
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
          const coCmp = String(a.co ?? "").localeCompare(String(b.co ?? ""));
          if (coCmp !== 0) return coCmp;
          const routeCmp = (a.route ?? "").localeCompare(b.route ?? "", undefined, { numeric: true });
          if (routeCmp !== 0) return routeCmp;
          return (a.eta_seq ?? 0) - (b.eta_seq ?? 0);
        });

      byStopId[stopId] = trimmed;

    }

    // Compute fares per route variant (co|route|dir|service_type) - base key without leg
    // Only compute if includeFares is true (deferred by default for faster initial load)
    let faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }> | undefined;

    if (parsed.data.includeFares) {
      faresByVariantKey = {};
      for (const [stopId, entries] of Object.entries(byStopId)) {
        for (const entry of entries) {
          const co = String(entry.co ?? "kmb");
          const route = String(entry.route ?? "").toUpperCase();
          const dir = String(entry.dir ?? "");
          const serviceType = String(entry.service_type ?? "");
          const vKey = `${co}|${route}|${dir}|${serviceType}`;

          if (faresByVariantKey[vKey]) continue;

          const destCandidates = [entry.dest_en, entry.dest_tc, entry.dest_sc].filter(Boolean).map(String);
          const fare = await getStopToTerminusFare({
            co,
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
        staleByStopId,
      },
      {
        headers: {
          ...KMB_NO_STORE_HEADERS,
          // This response includes ETA (no-store), but fare mapping is derived from daily-cached data.
          // Keep no-store to avoid stale ETAs; consumers can still use faresByVariantKey if present.
          "X-KMB-Fare-Cache": kmbFareCacheControlHeader(),
          "X-ETA-Stale": staleServed > 0 ? "1" : "0",
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
