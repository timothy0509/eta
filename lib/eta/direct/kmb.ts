import type { Company } from "hk-bus-eta";

import { kmbStopEtaKey } from "@/lib/eta/cache/keys";
import { CACHE_POLICIES } from "@/lib/eta/cache/policy";
import type { KmbRouteStopLite } from "@/lib/eta/client";
import {
  fetchKmbEtasForStop,
  findKmbRouteInfo,
  listKmbRouteStops,
  listKmbRoutes,
  listKmbStops,
  type KmbEta,
} from "@/lib/eta/direct/eta-db";
import {
  computeEtaLeg,
  getCachedKmbVariantStops,
  getStopToTerminusFare,
} from "@/lib/eta/kmb-fares";
import { promisePool } from "@/lib/eta/promise-pool";

import { getCachedValue, normalizeDirection } from "@/lib/eta/direct/shared";

export type KmbStop = {
  stop: string;
  co?: string;
  name_en: string;
  name_tc: string;
  name_sc: string;
  lat: string | number;
  long: string | number;
};

export type KmbEtaEntry = {
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
};

/** ETA entry augmented with leg info for circular route disambiguation */
export type KmbEtaEntryWithLeg = KmbEtaEntry & {
  /** "A" = departing leg (closer to first stop occurrence), "B" = arriving leg (closer to last stop occurrence), null = not a circular stop */
  leg: "A" | "B" | null;
};

function mapKmbEtaEntry(eta: KmbEta, stopId: string): KmbEtaEntry {
  const now = new Date().toISOString();
  return {
    co: eta.co ?? "kmb",
    route: eta.route,
    dir: eta.dir,
    service_type: eta.serviceType,
    seq: eta.seq,
    stop: stopId,
    dest_en: eta.dest?.en ?? "",
    dest_tc: eta.dest?.zh ?? "",
    dest_sc: eta.dest?.zh ?? "",
    eta_seq: eta.etaSeq,
    eta: eta.eta ?? "",
    rmk_en: eta.remark?.en ?? "",
    rmk_tc: eta.remark?.zh ?? "",
    rmk_sc: eta.remark?.zh ?? "",
    data_timestamp: now,
  };
}

export async function getKmbStops(): Promise<KmbStop[]> {
  const { value } = await getCachedValue({
    key: "kmb:stops",
    policyKey: "etaDb",
    policy: CACHE_POLICIES.etaDb,
    fetcher: async () => {
      const stops = await listKmbStops();
      return stops.map((stop) => ({
        stop: stop.stopId,
        name_en: stop.nameEn,
        name_tc: stop.nameTc,
        name_sc: stop.nameSc,
        lat: stop.lat,
        long: stop.lng,
      }));
    },
  });

  return value;
}

export async function getKmbEta(params: {
  stopId: string;
  route: string;
  serviceType: string;
}): Promise<KmbEtaEntry[]> {
  const etas = await fetchKmbEtasForStop({
    stopId: params.stopId,
    route: params.route,
    serviceType: params.serviceType,
    language: "tc",
  });
  return etas.map((eta) => mapKmbEtaEntry(eta, params.stopId));
}

/**
 * Fetch all ETAs at a stop using the Stop ETA API.
 * This returns all routes' ETAs in one call, much more efficient than per-route calls.
 * See: https://data.etabus.gov.hk - Stop ETA API (/v1/transport/kmb/stop-eta/{stop_id})
 */
export async function getKmbStopEta(stopId: string): Promise<KmbEtaEntry[]> {
  const etas = await fetchKmbEtasForStop({
    stopId,
    language: "tc",
  });
  return etas.map((eta) => mapKmbEtaEntry(eta, stopId));
}

export type KmbRouteStopEntry = {
  co: Company;
  route: string;
  bound: "I" | "O" | string;
  service_type: number | string;
  seq: number | string;
  stop: string;
};

export async function getKmbRouteStops(): Promise<KmbRouteStopEntry[]> {
  const { value } = await getCachedValue({
    key: "kmb:route-stops",
    policyKey: "etaDb",
    policy: CACHE_POLICIES.etaDb,
    fetcher: async () => {
      const routeStops = await listKmbRouteStops();
      return routeStops.map((entry) => ({
        co: entry.co,
        route: entry.route,
        bound: entry.bound,
        service_type: entry.serviceType,
        seq: entry.seq,
        stop: entry.stopId,
      }));
    },
  });

  return value;
}

export type KmbRouteInfo = {
  co: Company;
  route: string;
  bound: "I" | "O" | string;
  service_type: number | string;
  orig_en: string;
  orig_tc: string;
  orig_sc: string;
  dest_en: string;
  dest_tc: string;
  dest_sc: string;
};

export type KmbRouteListEntry = {
  co: Company;
  route: string;
  bound: "I" | "O" | string;
  service_type: number | string;
  orig_en: string;
  orig_tc: string;
  orig_sc: string;
  dest_en: string;
  dest_tc: string;
  dest_sc: string;
  data_timestamp?: string;
};

export async function getKmbRouteList(): Promise<KmbRouteListEntry[]> {
  const { value } = await getCachedValue({
    key: "kmb:routes",
    policyKey: "etaDb",
    policy: CACHE_POLICIES.etaDb,
    fetcher: async () => {
      const routes = await listKmbRoutes();
      return routes.map((entry) => ({
        co: entry.co,
        route: entry.route,
        bound: entry.bound,
        service_type: entry.serviceType,
        orig_en: entry.origin.en,
        orig_tc: entry.origin.tc,
        orig_sc: entry.origin.sc,
        dest_en: entry.destination.en,
        dest_tc: entry.destination.tc,
        dest_sc: entry.destination.sc,
      }));
    },
  });

  return value;
}

export async function getKmbRouteInfo(params: {
  co?: Company;
  route: string;
  direction: "I" | "O" | "inbound" | "outbound" | string;
  serviceType: string;
}): Promise<KmbRouteInfo> {
  const bound = normalizeDirection(params.direction);
  const info = await findKmbRouteInfo({
    co: params.co,
    route: params.route,
    bound,
    serviceType: params.serviceType,
  });

  if (!info) {
    throw new Error("KMB route info not found");
  }

  return {
    co: info.co,
    route: info.route,
    bound: info.bound,
    service_type: info.serviceType,
    orig_en: info.origin.en,
    orig_tc: info.origin.tc,
    orig_sc: info.origin.sc,
    dest_en: info.destination.en,
    dest_tc: info.destination.tc,
    dest_sc: info.destination.sc,
  };
}

const KMB_CONCURRENCY = 10;
const MAX_ETAS_PER_VARIANT = 3;

export type KmbStopEtasResponse = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>;
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }>;
  errors: string[];
  cached: number;
  fetched: number;
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>;
  truncatedStopIds?: string[];
};

export async function fetchKmbStopEtas(
  stopIds: string[],
  options?: { routeFilter?: string; includeFares?: boolean }
): Promise<KmbStopEtasResponse> {
  const dedupedStopIds = Array.from(new Set(stopIds));
  const uniqueStopIds = dedupedStopIds.slice(0, 100);
  const truncatedStopIds = dedupedStopIds.length > 100 ? dedupedStopIds.slice(100) : [];
  const routeFilterSet = options?.routeFilter
    ? new Set(
        options.routeFilter
          .split(",")
          .map((r) => r.trim().toUpperCase())
          .filter(Boolean)
      )
    : null;

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
    const cacheKey = kmbStopEtaKey(stopId);

    const cachedValue = await getCachedValue<KmbEtaEntryWithLeg[]>({
      key: cacheKey,
      policyKey: "kmbStopEta",
      policy: CACHE_POLICIES.kmbStopEta,
      allowStale: true,
      staleMaxMs: CACHE_POLICIES.kmbStopEta.maxStaleMs,
      fetcher: async () => {
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
      },
    });

    if (cachedValue.cached) cached += 1;
    if (!cachedValue.cached) fetched += 1;
    if (cachedValue.stale) {
      staleServed += 1;
    }
    staleByStopId[stopId] = {
      stale: cachedValue.stale,
      ageMs: cachedValue.ageMs,
    };

    return { stopId, eta: cachedValue.value };
  });

  for (let i = 0; i < results.length; i += 1) {
    const result = results[i];
    if (result.status === "rejected") {
      const stopId = uniqueStopIds[i];
      if (stopId) {
        errors.push(stopId);
      }
      continue;
    }

    const { stopId, eta } = result.value;

    let filtered: KmbEtaEntryWithLeg[] = eta;
    if (routeFilterSet && routeFilterSet.size > 0) {
      filtered = eta.filter((entry) => routeFilterSet.has((entry.route ?? "").toUpperCase()));
    }

    const byVariant = new Map<string, KmbEtaEntryWithLeg[]>();
    for (const entry of filtered) {
      const route = String(entry.route ?? "").toUpperCase();
      const dir = String(entry.dir ?? "");
      const serviceType = String(entry.service_type ?? "");
      const co = String(entry.co ?? "kmb");

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

  let faresByVariantKey:
    | Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }>
    | undefined;

  if (options?.includeFares) {
    faresByVariantKey = {};
    for (const [stopId, entries] of Object.entries(byStopId)) {
      for (const entry of entries) {
        const co = String(entry.co ?? "kmb");
        const route = String(entry.route ?? "").toUpperCase();
        const dir = String(entry.dir ?? "");
        const serviceType = String(entry.service_type ?? "");
        const vKey = `${co}|${route}|${dir}|${serviceType}`;

        if (faresByVariantKey[vKey]) continue;

        const destCandidates = [entry.dest_en, entry.dest_tc, entry.dest_sc]
          .filter(Boolean)
          .map(String);
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

  return {
    byStopId,
    faresByVariantKey,
    errors,
    cached,
    fetched,
    staleByStopId,
    ...(truncatedStopIds.length > 0 ? { truncatedStopIds } : null),
  };
}

export type KmbFareVariant = {
  co: Company;
  route: string;
  dir: string;
  serviceType: string;
  stopId: string;
  destCandidates?: string[];
};

export type KmbFaresResponse = {
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: "hk-bus-eta" }>;
};

export async function fetchKmbFares(variants: KmbFareVariant[]): Promise<KmbFaresResponse> {
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

  for (const v of variants) {
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

  return { faresByVariantKey };
}
