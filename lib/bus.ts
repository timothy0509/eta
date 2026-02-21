import { fetchEtaDb, fetchEtas } from "hk-bus-eta";
import type { Company, Eta, EtaDb, RouteListEntry } from "hk-bus-eta";

const CACHE_TTL_MS = 1000 * 60 * 30;
let cachedEtaDb: EtaDb | null = null;
let cachedAt = 0;

export const BUS_COMPANIES = [
  "kmb",
  "ctb",
  "nlb",
  "gmb",
  "lrtfeeder",
  "sunferry",
  "hkkf",
  "fortuneferry",
] as const;

export type BusCompany = (typeof BUS_COMPANIES)[number];

const EXCLUDED_COMPANIES = new Set<Company>(["mtr", "lightRail"]);

export type BusRouteSummary = {
  id: string;
  route: string;
  orig: string;
  dest: string;
  companies: BusCompany[];
  serviceType: string;
};

export type BusStopOption = {
  seq: number;
  stopIds: Partial<Record<BusCompany, string>>;
  names: Partial<Record<BusCompany, string>>;
};

export type BusStopData = {
  companies: BusCompany[];
  isJoint: boolean;
  stops: BusStopOption[];
};

export type BusEtaNormalized = {
  time: string;
  remark: string;
  company: BusCompany;
  destination: string;
};

export function isBusCompany(value: string | null): value is BusCompany {
  if (!value) return false;
  return BUS_COMPANIES.includes(value as BusCompany);
}

function isJointKmbCtb(companies: BusCompany[]): boolean {
  return companies.includes("kmb") && companies.includes("ctb");
}

async function loadEtaDb(): Promise<EtaDb> {
  const etaDb = await fetchEtaDb();
  cachedEtaDb = etaDb;
  cachedAt = Date.now();
  return etaDb;
}

export async function getEtaDb(): Promise<EtaDb> {
  if (!cachedEtaDb) {
    return loadEtaDb();
  }

  if (Date.now() - cachedAt > CACHE_TTL_MS) {
    return loadEtaDb();
  }

  return cachedEtaDb;
}

function getRouteCompanies(route: RouteListEntry): BusCompany[] {
  return route.co.filter(
    (company) => !EXCLUDED_COMPANIES.has(company),
  ) as BusCompany[];
}

function matchesQuery(route: RouteListEntry, query: string): boolean {
  const routeNumber = route.route.toUpperCase();
  const search = query.toUpperCase();
  return routeNumber.startsWith(search) || routeNumber === search;
}

export async function searchRoutes(
  query: string,
  language: "en" | "zh" = "en",
  company?: BusCompany,
): Promise<BusRouteSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const etaDb = await getEtaDb();
  const entries = Object.entries(etaDb.routeList);
  const results: BusRouteSummary[] = [];

  for (const [routeId, route] of entries) {
    if (!matchesQuery(route, trimmed)) continue;

    const companies = getRouteCompanies(route);
    if (companies.length === 0) continue;
    if (company && !companies.includes(company)) continue;

    const orig = language === "zh" ? route.orig.zh : route.orig.en;
    const dest = language === "zh" ? route.dest.zh : route.dest.en;

    results.push({
      id: routeId,
      route: route.route,
      orig,
      dest,
      companies,
      serviceType: route.serviceType,
    });
  }

  return results.sort((a, b) => a.route.localeCompare(b.route));
}

function buildStopOptions(
  route: RouteListEntry,
  etaDb: EtaDb,
  companies: BusCompany[],
  language: "en" | "zh",
): BusStopOption[] {
  const maxLength = companies.reduce((max, company) => {
    const length = route.stops[company]?.length ?? 0;
    return Math.max(max, length);
  }, 0);

  const stops: BusStopOption[] = [];

  for (let seq = 0; seq < maxLength; seq += 1) {
    const stopIds: Partial<Record<BusCompany, string>> = {};
    const names: Partial<Record<BusCompany, string>> = {};
    let hasAny = false;

    for (const company of companies) {
      const stopId = route.stops[company]?.[seq];
      if (!stopId) continue;
      hasAny = true;
      stopIds[company] = stopId;
      const stopName = etaDb.stopList[stopId]?.name?.[language];
      names[company] = stopName ?? stopId;
    }

    if (hasAny) {
      stops.push({ seq, stopIds, names });
    }
  }

  return stops;
}

export async function getRouteStopData(
  routeId: string,
  language: "en" | "zh" = "en",
): Promise<BusStopData | null> {
  const etaDb = await getEtaDb();
  const route = etaDb.routeList[routeId];
  if (!route) return null;

  const companies = getRouteCompanies(route);
  if (companies.length === 0) return null;

  const stops = buildStopOptions(route, etaDb, companies, language);

  return {
    companies,
    isJoint: isJointKmbCtb(companies),
    stops,
  };
}

export async function getRouteEtas(
  routeId: string,
  seq: number,
  language: "en" | "zh" = "en",
): Promise<BusEtaNormalized[]> {
  const etaDb = await getEtaDb();
  const route = etaDb.routeList[routeId];
  if (!route) return [];

  const companies = getRouteCompanies(route).filter(
    (company) => route.stops[company]?.[seq],
  );

  if (companies.length === 0) return [];

  const etas = await fetchEtas({
    ...route,
    co: companies,
    seq,
    language,
    stopList: etaDb.stopList,
    holidays: etaDb.holidays,
    serviceDayMap: etaDb.serviceDayMap,
  });

  return etas.map((eta: Eta) => ({
    time: eta.eta,
    remark: language === "zh" ? eta.remark?.zh ?? "" : eta.remark?.en ?? "",
    company: eta.co as BusCompany,
    destination:
      language === "zh" ? eta.dest?.zh ?? "" : eta.dest?.en ?? "",
  }));
}
