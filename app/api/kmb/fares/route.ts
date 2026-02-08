import type { KmbRouteStopLite } from "@/lib/eta/client";
import { listKmbRouteStops } from "@/lib/eta/hk-bus-eta";
import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { getCachedKmbVariantStops, getStopToTerminusFare, kmbFareCacheControlHeader } from "@/lib/eta/kmb-fares";
import { NextResponse } from "next/server";
import { z } from "zod";

const VariantSchema = z.object({
  co: z.string().optional(),
  route: z.string(),
  dir: z.string(),
  serviceType: z.string(),
  stopId: z.string(),
  destCandidates: z.array(z.string()).optional(),
});

const BodySchema = z.object({
  variants: z.array(VariantSchema).min(1).max(200),
});

/**
 * POST /api/kmb/fares
 *
 * Computes fares for a list of route variants (deferred from stop-etas for speed).
 *
 * Request body:
 * {
 *   variants: Array<{
 *     route: string;
 *     dir: string;
 *     serviceType: string;
 *     stopId: string;
 *     destCandidates?: string[];
 *   }>
 * }
 *
 * Response:
 * {
 *   faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }>
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

  try {
    // Load variant stops (cached daily)
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

    const faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }> = {};

    for (const v of parsed.data.variants) {
      const co = String(v.co ?? "kmb");
      const route = v.route.toUpperCase();
      const vKey = `${co}|${route}|${v.dir}|${v.serviceType}`;

      if (faresByVariantKey[vKey]) continue;

      const fare = await getStopToTerminusFare({
        co,
        route,
        dir: v.dir,
        serviceType: v.serviceType,
        stopId: v.stopId,
        etaDestCandidates: v.destCandidates ?? [],
        byVariantStops,
      });

      if (fare) {
        faresByVariantKey[vKey] = fare;
      }
    }

    return NextResponse.json(
      { faresByVariantKey },
      {
        headers: {
          // Fares are derived from daily-cached data so can be cached longer
          "Cache-Control": kmbFareCacheControlHeader(),
        },
      }
    );
  } catch (error) {
    console.error("/api/kmb/fares failed", error);
    return NextResponse.json(
      { error: "Failed to compute fares" },
      { status: 500, headers: KMB_NO_STORE_HEADERS }
    );
  }
}
