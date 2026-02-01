import { fetchEtaDb, fetchEtaDbMd5, fetchEtas } from "hk-bus-eta";
import type { Eta, EtaDb, RouteListEntry, StopList } from "hk-bus-eta";

import { etaDbCache } from "@/lib/eta/cache";
import type { UiLanguage } from "@/lib/eta/types";

type EtaDbCacheValue = {
  db: EtaDb;
  md5: string;
  fetchedAt: number;
};

type EtaDbIndexes = {
  kmbRouteListEntries: RouteListEntry[];
  kmbStops: KmbStopSearchItem[];
  kmbRouteStops: KmbRouteStopLite[];
  mtrRoutes: RouteListEntry[];
  lrtRoutes: RouteListEntry[];
  stationToRouteIndex: Map<string, RouteListEntry[]>;
};

const ETA_DB_CACHE_KEY = "hk-bus-eta:db";
const ETA_DB_MD5_KEY = "hk-bus-eta:md5";
const ETA_DB_TTL_MS = 24 * 60 * 60 * 1000;

let cachedIndexes: { md5: string; value: EtaDbIndexes } | null = null;

export type KmbStopSearchItem = {
  stopId: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
  lat: number;
  lng: number;
};

export type KmbRouteStopLite = {
  route: string;
  bound: "I" | "O" | string;
  serviceType: string;
  seq: number;
  stopId: string;
};

export type KmbRouteInfoLite = {
  route: string;
  bound: "I" | "O" | string;
  serviceType: string;
  origin: {
    en: string;
    tc: string;
    sc: string;
  };
  destination: {
    en: string;
    tc: string;
    sc: string;
  };
  routeEntry: RouteListEntry;
};

export function toHkBusEtaLanguage(lang: UiLanguage): "en" | "zh" {
  if (lang === "en") return "en";
  return "zh";
}

function normalizeBound(bound?: string | null): "I" | "O" | string {
  if (!bound) return "";
  return bound === "I" || bound === "O" ? bound : bound;
}

function normalizeStopId(stopId: string): string {
  return String(stopId ?? "").trim();
}

function mapEtaLangToUi(eta: { en: string; zh: string }) {
  return {
    en: eta.en ?? "",
    tc: eta.zh ?? "",
    sc: eta.zh ?? "",
  };
}

export async function getEtaDbIndexes(): Promise<EtaDbIndexes> {
  const db = await getEtaDbCached();
  const cachedMd5 = etaDbCache.get(ETA_DB_MD5_KEY) as string | undefined;

  if (cachedIndexes && cachedMd5 && cachedIndexes.md5 === cachedMd5) {
    return cachedIndexes.value;
  }

  const kmbRouteListEntries = Object.values(db.routeList).filter((entry) =>
    entry.co.includes("kmb") && entry.stops.kmb?.length
  );

  const kmbStops = Object.entries(db.stopList)
    .map(([stopId, stop]) => ({
      stopId: normalizeStopId(stopId),
      nameEn: (stop.name.en ?? "").trim(),
      nameTc: (stop.name.zh ?? "").trim(),
      nameSc: (stop.name.zh ?? "").trim(),
      lat: stop.location.lat,
      lng: stop.location.lng,
    }))
    .filter((s) => s.stopId && s.nameEn);

  const kmbRouteStops: KmbRouteStopLite[] = kmbRouteListEntries.flatMap((entry) => {
    const stops = entry.stops.kmb ?? [];
    return stops.map((stopId, idx) => ({
      route: entry.route,
      bound: normalizeBound(entry.bound.kmb),
      serviceType: entry.serviceType,
      seq: idx + 1,
      stopId: normalizeStopId(stopId),
    }));
  });

  const mtrRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes("mtr"));
  const lrtRoutes = Object.values(db.routeList).filter((entry) => entry.co.includes("lightRail"));

  const stationToRouteIndex = new Map<string, RouteListEntry[]>();
  for (const entry of kmbRouteListEntries) {
    const stops = entry.stops.kmb ?? [];
    for (const stopId of stops) {
      const key = normalizeStopId(stopId);
      if (!key) continue;
      const list = stationToRouteIndex.get(key) ?? [];
      list.push(entry);
      stationToRouteIndex.set(key, list);
    }
  }

  const value = {
    kmbRouteListEntries,
    kmbStops,
    kmbRouteStops,
    mtrRoutes,
    lrtRoutes,
    stationToRouteIndex,
  };

  if (cachedMd5) {
    cachedIndexes = { md5: cachedMd5, value };
  }

  return value;
}

export async function getEtaDbCached(): Promise<EtaDb> {
  const cached = etaDbCache.get(ETA_DB_CACHE_KEY) as EtaDbCacheValue | undefined;
  if (cached) return cached.db;

  const [db, md5] = await Promise.all([fetchEtaDb(), fetchEtaDbMd5()]);
  const payload: EtaDbCacheValue = {
    db,
    md5,
    fetchedAt: Date.now(),
  };
  etaDbCache.set(ETA_DB_CACHE_KEY, payload, ETA_DB_TTL_MS);
  etaDbCache.set(ETA_DB_MD5_KEY, md5, ETA_DB_TTL_MS);
  return db;
}

export async function listKmbStops(): Promise<KmbStopSearchItem[]> {
  const { kmbStops } = await getEtaDbIndexes();
  return kmbStops;
}

export async function listKmbRoutes(): Promise<KmbRouteInfoLite[]> {
  const { kmbRouteListEntries } = await getEtaDbIndexes();
  return kmbRouteListEntries.map((entry) => ({
    route: entry.route,
    bound: normalizeBound(entry.bound.kmb),
    serviceType: entry.serviceType,
    origin: mapEtaLangToUi(entry.orig),
    destination: mapEtaLangToUi(entry.dest),
    routeEntry: entry,
  }));
}

export async function listKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const { kmbRouteStops } = await getEtaDbIndexes();
  return kmbRouteStops;
}

export async function findKmbRouteInfo(params: {
  route: string;
  bound: string;
  serviceType: string;
}): Promise<KmbRouteInfoLite | null> {
  const { kmbRouteListEntries } = await getEtaDbIndexes();
  const routeName = params.route.toUpperCase();
  const bound = normalizeBound(params.bound);
  const serviceType = String(params.serviceType ?? "");

  const entry = kmbRouteListEntries.find((item) => {
    if (item.route.toUpperCase() !== routeName) return false;
    if (String(item.serviceType) !== serviceType) return false;
    return normalizeBound(item.bound.kmb) === bound;
  });

  if (!entry) return null;

  return {
    route: entry.route,
    bound: normalizeBound(entry.bound.kmb),
    serviceType: entry.serviceType,
    origin: mapEtaLangToUi(entry.orig),
    destination: mapEtaLangToUi(entry.dest),
    routeEntry: entry,
  };
}

export type KmbEta = Eta & {
  route: string;
  dir: string;
  serviceType: string;
  seq: number;
  etaSeq: number;
};

export async function fetchKmbEtasForStop(params: {
  stopId: string;
  route?: string;
  serviceType?: string;
  language: UiLanguage;
}): Promise<KmbEta[]> {
  const db = await getEtaDbCached();
  const { stationToRouteIndex } = await getEtaDbIndexes();
  const stopId = normalizeStopId(params.stopId);
  const routeFilter = params.route ? params.route.toUpperCase() : null;
  const serviceType = params.serviceType ? String(params.serviceType) : null;
  const language = toHkBusEtaLanguage(params.language);

  const candidates = (stationToRouteIndex.get(stopId) ?? []).filter((entry) => {
    if (routeFilter && entry.route.toUpperCase() !== routeFilter) return false;
    if (serviceType && String(entry.serviceType) !== serviceType) return false;
    return true;
  });

  if (candidates.length === 0) return [] as KmbEta[];

  const etas = await Promise.all(
    candidates.map(async (entry) => {
      const stopIndex = (entry.stops.kmb ?? []).findIndex((s) => normalizeStopId(s) === stopId);
      if (stopIndex < 0) return [] as KmbEta[];
      const result = await fetchEtas({
        ...entry,
        seq: stopIndex,
        language,
        stopList: db.stopList as StopList,
        holidays: db.holidays,
        serviceDayMap: db.serviceDayMap,
      });
      return result.map((eta, idx) => ({
        ...eta,
        route: entry.route,
        dir: normalizeBound(entry.bound.kmb),
        serviceType: entry.serviceType,
        seq: stopIndex + 1,
        etaSeq: idx + 1,
      }));
    })
  );

  return etas.flat();
}

export async function listMtrRoutes(): Promise<RouteListEntry[]> {
  const { mtrRoutes } = await getEtaDbIndexes();
  return mtrRoutes;
}

export async function listLrtRoutes(): Promise<RouteListEntry[]> {
  const { lrtRoutes } = await getEtaDbIndexes();
  return lrtRoutes;
}

export async function fetchMtrEtasForStop(params: {
  line: string;
  sta: string;
  bound: string;
  serviceType: string;
  language: UiLanguage;
}): Promise<Eta[]> {
  const db = await getEtaDbCached();
  const { mtrRoutes } = await getEtaDbIndexes();
  const line = params.line.toUpperCase();
  const sta = params.sta.toUpperCase();
  const bound = String(params.bound ?? "");
  const serviceType = String(params.serviceType ?? "");
  const entry = mtrRoutes.find((item) => {
    if (item.route.toUpperCase() !== line) return false;
    if (String(item.serviceType) !== serviceType) return false;
    return String(item.bound.mtr ?? "") === bound;
  });

  if (!entry) return [];
  const stops = entry.stops.mtr ?? [];
  const seq = stops.findIndex((stopId) => normalizeStopId(stopId) === sta);
  if (seq < 0) return [];

  return await fetchEtas({
    ...entry,
    seq,
    language: toHkBusEtaLanguage(params.language),
    stopList: db.stopList as StopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  });
}

export async function fetchLrtEtasForStop(params: {
  route: string;
  bound: string;
  serviceType: string;
  stationId: string;
  language: UiLanguage;
}): Promise<Eta[]> {
  const db = await getEtaDbCached();
  const { lrtRoutes } = await getEtaDbIndexes();
  const route = params.route.toUpperCase();
  const bound = normalizeBound(params.bound);
  const serviceType = String(params.serviceType ?? "");
  const stopId = `LR${String(params.stationId).padStart(3, "0")}`;

  const entry = lrtRoutes.find((item) => {
    if (item.route.toUpperCase() !== route) return false;
    if (String(item.serviceType) !== serviceType) return false;
    return normalizeBound(item.bound.lightRail) === bound;
  });

  if (!entry) return [];
  const stops = entry.stops.lightRail ?? [];
  const seq = stops.findIndex((id) => normalizeStopId(id) === stopId);
  if (seq < 0) return [];

  return await fetchEtas({
    ...entry,
    seq,
    language: toHkBusEtaLanguage(params.language),
    stopList: db.stopList as StopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  });
}

/**
 * Get fare for a specific route variant from hk-bus-eta data.
 * Fares array index corresponds to stop sequence (0-indexed).
 */
export async function getKmbFareFromEtaDb(params: {
  route: string;
  bound: string;
  serviceType: string;
  stopSeq: number;
  isHoliday?: boolean;
}): Promise<{ hkd: number; source: string } | null> {
  const { kmbRouteListEntries } = await getEtaDbIndexes();
  const routeName = params.route.toUpperCase();
  const bound = normalizeBound(params.bound);
  const serviceType = String(params.serviceType ?? "");
  const stopSeq = params.stopSeq - 1; // Convert to 0-indexed

  const entry = kmbRouteListEntries.find((item) => {
    if (item.route.toUpperCase() !== routeName) return false;
    if (String(item.serviceType) !== serviceType) return false;
    return normalizeBound(item.bound.kmb) === bound;
  });

  if (!entry) return null;

  const fares = params.isHoliday ? entry.faresHoliday : entry.fares;
  if (!fares || stopSeq < 0 || stopSeq >= fares.length) return null;

  const fareStr = fares[stopSeq];
  if (!fareStr) return null;

  const fare = Number(fareStr);
  if (!Number.isFinite(fare) || fare < 0) return null;

  return {
    hkd: fare,
    source: "hk-bus-eta",
  };
}
