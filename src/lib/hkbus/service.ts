import type { EtaDb } from "hk-bus-eta";

import { hkBusClient } from "@/lib/hkbus/client";
import { getEtaDbCached, getEtaFromCache, setEtaInCache } from "@/lib/hkbus/cache";
import {
  isBusOperator,
  searchBusRoutes,
  toBusRouteRecords,
  toEtaRecords,
  toRouteStops,
} from "@/lib/hkbus/normalize";
import type {
  BusCompany,
  EtaRecord,
  Language,
  RawRoute,
  RouteRecord,
  RouteStopRecord,
} from "@/lib/hkbus/types";

function makeEtaCacheKey(input: {
  routeId: string;
  operator: BusCompany;
  seq: number;
  lang: Language;
}): string {
  return ["eta", input.routeId, input.operator, String(input.seq), input.lang].join(":");
}

function getRawRoute(db: EtaDb, routeId: string): RawRoute {
  const route = db.routeList[routeId];

  if (!route) {
    throw new Error(`Route not found: ${routeId}`);
  }

  return {
    routeId,
    route,
  };
}

function assertOperatorOnRoute(route: RawRoute, operator: BusCompany): void {
  if (!route.route.co.some((company) => company === operator)) {
    throw new Error(`Route ${route.routeId} does not include operator ${operator}`);
  }

  if (!isBusOperator(operator)) {
    throw new Error(`Unsupported bus operator: ${operator}`);
  }
}

function assertSequenceWithinRange(stopsCount: number, seq: number): void {
  if (seq < 0 || seq >= stopsCount) {
    throw new Error(`Sequence out of range: ${seq} (expected 0-${Math.max(0, stopsCount - 1)})`);
  }
}

export async function getRoutes(input: {
  query?: string;
  operator?: BusCompany;
  limit?: number;
}): Promise<RouteRecord[]> {
  const { db } = await getEtaDbCached();
  const routes = toBusRouteRecords(db);
  return searchBusRoutes(routes, input);
}

export async function getRouteStops(input: {
  routeId: string;
  operator: BusCompany;
}): Promise<RouteStopRecord[]> {
  const { db } = await getEtaDbCached();
  const rawRoute = getRawRoute(db, input.routeId);
  assertOperatorOnRoute(rawRoute, input.operator);

  return toRouteStops(db, rawRoute, input.operator);
}

export async function getEta(input: {
  routeId: string;
  operator: BusCompany;
  seq: number;
  lang: Language;
}): Promise<EtaRecord[]> {
  const cacheKey = makeEtaCacheKey(input);
  const cached = getEtaFromCache(cacheKey);
  if (cached) {
    return cached;
  }

  const { db } = await getEtaDbCached();
  const rawRoute = getRawRoute(db, input.routeId);
  assertOperatorOnRoute(rawRoute, input.operator);

  const stopsCount = rawRoute.route.stops[input.operator]?.length ?? 0;
  assertSequenceWithinRange(stopsCount, input.seq);

  const etas = await hkBusClient.fetchEtas({
    ...rawRoute.route,
    seq: input.seq,
    language: input.lang,
    stopList: db.stopList,
    holidays: db.holidays,
    serviceDayMap: db.serviceDayMap,
  });

  const normalized = toEtaRecords(etas).filter((item) => item.company === input.operator);
  setEtaInCache(cacheKey, normalized);
  return normalized;
}
