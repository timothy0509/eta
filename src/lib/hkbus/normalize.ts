import {
  BUS_COMPANIES,
  DEFAULT_ROUTE_SEARCH_LIMIT,
} from "@/lib/hkbus/constants";
import type {
  BusCompany,
  Eta,
  EtaDb,
  EtaRecord,
  RawRoute,
  RouteRecord,
  RouteStopRecord,
  StopListEntry,
} from "@/lib/hkbus/types";

const busCompanySet = new Set<string>(BUS_COMPANIES);

function asBusCompany(value: string): BusCompany | null {
  return busCompanySet.has(value) ? (value as BusCompany) : null;
}

function routeIncludesBusOperator(routeCompanies: readonly string[]): boolean {
  return routeCompanies.some((company) => busCompanySet.has(company));
}

function matchText(value: string, query: string): boolean {
  return value.toLowerCase().includes(query.toLowerCase());
}

export function toBusRouteRecords(db: EtaDb): RouteRecord[] {
  return Object.entries(db.routeList)
    .filter(([, route]) => routeIncludesBusOperator(route.co))
    .map(([routeId, route]) => {
      const companies = route.co
        .map((company) => asBusCompany(company))
        .filter((company): company is BusCompany => company !== null);

      const totalStopsByCompany: Partial<Record<BusCompany, number>> = {};
      for (const company of companies) {
        totalStopsByCompany[company] = route.stops[company]?.length ?? 0;
      }

      return {
        id: routeId,
        route: route.route,
        serviceType: route.serviceType,
        companies,
        origin: {
          en: route.orig.en,
          zh: route.orig.zh,
        },
        destination: {
          en: route.dest.en,
          zh: route.dest.zh,
        },
        totalStopsByCompany,
      } satisfies RouteRecord;
    });
}

export function searchBusRoutes(
  routes: RouteRecord[],
  input: {
    query?: string;
    operator?: BusCompany;
    limit?: number;
  }
): RouteRecord[] {
  const limit = input.limit ?? DEFAULT_ROUTE_SEARCH_LIMIT;
  const query = input.query?.trim();
  const operator = input.operator;

  let filtered = routes;

  if (operator) {
    filtered = filtered.filter((route) => route.companies.includes(operator));
  }

  if (query) {
    filtered = filtered.filter((route) => {
      return (
        matchText(route.id, query) ||
        matchText(route.route, query) ||
        matchText(route.origin.en, query) ||
        matchText(route.origin.zh, query) ||
        matchText(route.destination.en, query) ||
        matchText(route.destination.zh, query)
      );
    });
  }

  return filtered.slice(0, limit);
}

function assertStop(stop: StopListEntry | undefined, stopId: string): StopListEntry {
  if (stop) {
    return stop;
  }

  throw new Error(`Stop not found in stopList: ${stopId}`);
}

export function toRouteStops(
  db: EtaDb,
  rawRoute: RawRoute,
  operator: BusCompany
): RouteStopRecord[] {
  const stopIds = rawRoute.route.stops[operator] ?? [];

  return stopIds.map((stopId, index) => {
    const stop = assertStop(db.stopList[stopId], stopId);

    return {
      sequence: index,
      stopId,
      company: operator,
      name: {
        en: stop.name.en,
        zh: stop.name.zh,
      },
      location: {
        lat: stop.location.lat,
        lng: stop.location.lng,
      },
    } satisfies RouteStopRecord;
  });
}

function diffInMinutes(etaIso: string, now: Date): number | null {
  const etaTime = new Date(etaIso).getTime();

  if (Number.isNaN(etaTime)) {
    return null;
  }

  const diffMs = etaTime - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  return diffMin < 0 ? 0 : diffMin;
}

function isBusEta(item: Eta): item is Eta & { co: BusCompany } {
  return isBusOperator(item.co);
}

export function toEtaRecords(etas: Eta[], now = new Date()): EtaRecord[] {
  const records = etas
    .filter(isBusEta)
    .map((item) => ({
      eta: item.eta,
      isoEta: item.eta,
      company: item.co,
      destination: {
        en: item.dest.en,
        zh: item.dest.zh,
      },
      remark: {
        en: item.remark.en,
        zh: item.remark.zh,
      },
      minutes: diffInMinutes(item.eta, now),
    }));

  return records;
}

export function isBusOperator(company: string): company is BusCompany {
  return busCompanySet.has(company);
}
