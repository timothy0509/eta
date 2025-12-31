import fareIndex from "@/data/fare/kmb-fare-index.v1.json";

import type { KmbRouteStopLite } from "@/lib/eta/client";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";

export type KmbFareInfo = {
  hkd: number;
  dayCode?: number;
  source: "td-fare";
};

type FareIndexV1 = {
  version: 1;
  generatedAt: string;
  dayCodePriority: number[];
  routeCandidatesByName: Record<string, Array<{ routeId: number; companyCode?: string | null }>>;
  stopNameByKey: Record<string, { en: string; tc: string; sc: string }>;
  fareByKey: Record<string, { price: number; dayCode: number }>;
};

const index = fareIndex as unknown as FareIndexV1;

type VariantKey = `${string}|${string}|${string}`;

export type VariantStops = {
  variantKey: VariantKey;
  /** Maps stopId -> array of sequence numbers (sorted ascending). Supports circular routes where a stop appears twice. */
  stopSeqsByStopId: Map<string, number[]>;
  terminusSeq: number;
};

let cachedVariantStops: { expiresAtMs: number; byVariantKey: Map<VariantKey, VariantStops> } | null =
  null;

function normalizeRouteName(route: string): string {
  return String(route ?? "").trim().toUpperCase();
}

function variantKey(route: string, bound: string, serviceType: string): VariantKey {
  return `${normalizeRouteName(route)}|${String(bound ?? "")}|${String(serviceType ?? "")}`;
}

function getKmbDirRouteSeq(dir: string): 1 | 2 {
  // KMB convention: O = outbound, I = inbound.
  // Fare dataset uses ROUTE_SEQ: 1=outbound/circular, 2=inbound.
  return String(dir) === "I" ? 2 : 1;
}

function scoreStopNameMatch(a: string, b: string): number {
  const x = a.trim();
  const y = b.trim();
  if (!x || !y) return 0;
  if (x === y) return 3;
  if (x.includes(y) || y.includes(x)) return 2;
  return 0;
}

function chooseBestRouteIdCandidate(routeName: string, terminusNameCandidates: string[], routeSeq: 1 | 2) {
  const candidates = index.routeCandidatesByName[routeName] ?? [];
  if (candidates.length === 0) return null;

  // Prefer candidates whose terminus stop name best matches our terminus name set.
  // We use stopSeq=1 (first stop) and max seq is unknown here, so we approximate with far end by scanning
  // a small range; since stopNameByKey is sparse index, this often still works.

  type Scored = { routeId: number; score: number };
  const scored: Scored[] = [];

  for (const c of candidates) {
    const routeId = Number(c.routeId);
    if (!Number.isFinite(routeId)) continue;

    // Attempt to find a terminus name by probing common terminus sequences.
    // Without having RSTOP counts, we rely on matching any stopNameByKey entries.
    // We'll take the best match across all known stopSeq keys for this routeId+routeSeq.
    let best = 0;
    for (const [key, names] of Object.entries(index.stopNameByKey)) {
      if (!key.startsWith(`${routeId}|${routeSeq}|`)) continue;
      for (const t of terminusNameCandidates) {
        best = Math.max(best, scoreStopNameMatch(names.en, t));
        best = Math.max(best, scoreStopNameMatch(names.tc, t));
        best = Math.max(best, scoreStopNameMatch(names.sc, t));
      }
      if (best >= 3) break;
    }

    scored.push({ routeId, score: best });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.routeId ?? null;
}

export function computeKmbRouteVariantStops(routeStops: KmbRouteStopLite[]) {
  const byVariantKey = new Map<VariantKey, VariantStops>();

  for (const rs of routeStops) {
    const key = variantKey(rs.route, rs.bound, rs.serviceType);
    const existing = byVariantKey.get(key);
    const stopId = String(rs.stopId ?? "").trim();
    if (!stopId) continue;

    if (!existing) {
      const stopSeqsByStopId = new Map<string, number[]>();
      stopSeqsByStopId.set(stopId, [rs.seq]);
      byVariantKey.set(key, {
        variantKey: key,
        stopSeqsByStopId,
        terminusSeq: rs.seq,
      });
    } else {
      const seqs = existing.stopSeqsByStopId.get(stopId);
      if (seqs) {
        // Insert in sorted order
        const insertIdx = seqs.findIndex((s) => s > rs.seq);
        if (insertIdx === -1) {
          seqs.push(rs.seq);
        } else {
          seqs.splice(insertIdx, 0, rs.seq);
        }
      } else {
        existing.stopSeqsByStopId.set(stopId, [rs.seq]);
      }
      if (rs.seq > existing.terminusSeq) existing.terminusSeq = rs.seq;
    }
  }

  return byVariantKey;
}

export async function getCachedKmbVariantStops(fetchRouteStops: () => Promise<KmbRouteStopLite[]>) {
  const now = Date.now();
  if (cachedVariantStops && cachedVariantStops.expiresAtMs > now) {
    return cachedVariantStops.byVariantKey;
  }

  const routeStops = await fetchRouteStops();
  const byVariantKey = computeKmbRouteVariantStops(routeStops);

  const ttlSeconds = secondsUntilNextKmbDailyUpdate();
  cachedVariantStops = {
    expiresAtMs: now + ttlSeconds * 1000,
    byVariantKey,
  };

  return byVariantKey;
}

export function kmbFareCacheControlHeader() {
  return kmbDailyCacheControlHeader(secondsUntilNextKmbDailyUpdate());
}

export function getStopToTerminusFare(params: {
  route: string;
  dir: string;
  serviceType: string;
  stopId: string;
  // For disambiguation: KMB ETA provides destination strings; use them if possible.
  etaDestCandidates?: string[];
  byVariantStops: Map<VariantKey, VariantStops>;
}): KmbFareInfo | null {
  const routeName = normalizeRouteName(params.route);
  const routeSeq = getKmbDirRouteSeq(params.dir);

  const key = variantKey(routeName, params.dir, params.serviceType);
  const variant = params.byVariantStops.get(key);
  if (!variant) return null;

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? "").trim());
  // Use the first (smallest) sequence for fare calculation - this is the "departing" occurrence
  const onSeq = seqs?.[0];
  if (!onSeq) return null;

  const offSeq = variant.terminusSeq;
  if (!Number.isFinite(offSeq) || offSeq <= 0) return null;

  // Map routeName -> routeId using candidates.
  const routeId = chooseBestRouteIdCandidate(routeName, params.etaDestCandidates ?? [], routeSeq);
  if (!routeId) return null;

  const fareKey = `${routeId}|${routeSeq}|${onSeq}|${offSeq}`;
  const fare = index.fareByKey[fareKey];
  if (!fare) return null;

  return {
    hkd: Number(fare.price),
    dayCode: Number(fare.dayCode),
    source: "td-fare",
  };
}

/**
 * Determine which "leg" an ETA entry belongs to for circular routes or routes
 * where a stop appears multiple times.
 *
 * Returns:
 * - "A" if the entry's seq is closer to the first (smallest) occurrence of the stop
 * - "B" if the entry's seq is closer to the last (largest) occurrence of the stop
 * - null if the stop only appears once (no leg disambiguation needed)
 */
export function computeEtaLeg(params: {
  route: string;
  dir: string;
  serviceType: string;
  stopId: string;
  etaSeq: number;
  byVariantStops: Map<VariantKey, VariantStops>;
}): "A" | "B" | null {
  const routeName = normalizeRouteName(params.route);
  const key = variantKey(routeName, params.dir, params.serviceType);
  const variant = params.byVariantStops.get(key);
  if (!variant) return null;

  const seqs = variant.stopSeqsByStopId.get(String(params.stopId ?? "").trim());
  if (!seqs || seqs.length < 2) return null;

  const seqA = seqs[0]; // smallest (first occurrence)
  const seqB = seqs[seqs.length - 1]; // largest (last occurrence)

  const distA = Math.abs(params.etaSeq - seqA);
  const distB = Math.abs(params.etaSeq - seqB);

  return distA <= distB ? "A" : "B";
}

export { type VariantKey };
