import { NextResponse } from "next/server";
import { z } from "zod";

import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getKmbStopEta, type KmbEtaEntry } from "@/lib/eta/kmb";
import { promisePool } from "@/lib/eta/promise-pool";
import { kmbStopEtaCache } from "@/lib/eta/cache";

const BodySchema = z.object({
  stopIds: z.array(z.string().trim().min(1)).min(1).max(100),
  routeFilter: z.string().optional(),
});

// Concurrency limit for upstream calls
const KMB_CONCURRENCY = 6;

// Max ETAs per route+direction to return (keep payload small)
const MAX_ETAS_PER_VARIANT = 3;

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
    const byStopId: Record<string, KmbEtaEntry[]> = {};
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

      // Fetch from upstream
      const eta = await getKmbStopEta(stopId);
      kmbStopEtaCache.set(cacheKey, eta);
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
      let filtered = eta;
      if (routeFilterSet && routeFilterSet.size > 0) {
        filtered = eta.filter((entry) =>
          routeFilterSet.has((entry.route ?? "").toUpperCase())
        );
      }

      // Group by route+dir+service_type and limit to MAX_ETAS_PER_VARIANT
      const byVariant = new Map<string, KmbEtaEntry[]>();
      for (const entry of filtered) {
        const key = `${entry.route}|${entry.dir}|${entry.service_type}`;
        const existing = byVariant.get(key) ?? [];
        if (existing.length < MAX_ETAS_PER_VARIANT) {
          existing.push(entry);
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

    return NextResponse.json(
      {
        byStopId,
        errors,
        cached,
        fetched,
      },
      {
        headers: KMB_NO_STORE_HEADERS,
      }
    );
  } catch (error) {
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
