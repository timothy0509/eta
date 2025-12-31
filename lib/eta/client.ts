import type { KmbStopSearchItem } from "@/lib/eta/types";
import type { KmbEtaEntry, KmbRouteListEntry, KmbStop } from "@/lib/eta/kmb";
import type { MtrScheduleResponse } from "@/lib/eta/mtr";

/** ETA entry augmented with leg info for circular route disambiguation */
export type KmbEtaEntryWithLeg = KmbEtaEntry & {
  /** "A" = departing leg (closer to first stop occurrence), "B" = arriving leg (closer to last stop occurrence), null = not a circular stop */
  leg: "A" | "B" | null;
};

export async function fetchKmbStops(): Promise<KmbStopSearchItem[]> {
  const response = await fetch("/api/kmb/stops", {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to load stops: ${response.status}`);
  }

  const json = (await response.json()) as { stops: KmbStop[] };

  return json.stops
    .map((s) => ({
      stopId: s.stop,
      nameEn: (s.name_en ?? "").trim(),
      nameTc: (s.name_tc ?? "").trim(),
      nameSc: (s.name_sc ?? "").trim(),
      lat: typeof s.lat === "string" ? Number(s.lat) : s.lat,
      lng: typeof s.long === "string" ? Number(s.long) : s.long,
    }))
    .filter((s) => s.stopId && s.nameEn);
}

export async function fetchKmbRoutes(): Promise<KmbRouteListEntry[]> {
  const response = await fetch("/api/kmb/routes", {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to load routes: ${response.status}`);
  }

  const json = (await response.json()) as { routes: KmbRouteListEntry[] };
  return json.routes;
}

export type KmbRouteStopLite = {
  route: string;
  bound: "I" | "O" | string;
  serviceType: string;
  seq: number;
  stopId: string;
};

export async function fetchKmbRouteStops(): Promise<KmbRouteStopLite[]> {
  const response = await fetch("/api/kmb/route-stop", {
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`Failed to load route-stop: ${response.status}`);
  }

  const json = (await response.json()) as {
    data: Array<{
      route: string;
      bound: "I" | "O" | string;
      service_type: number | string;
      seq: number | string;
      stop: string;
    }>;
  };

  return json.data
    .map((entry) => ({
      route: entry.route,
      bound: entry.bound,
      serviceType: String(entry.service_type),
      seq: typeof entry.seq === "string" ? Number(entry.seq) : entry.seq,
      stopId: entry.stop,
    }))
    .filter((entry) => entry.route && entry.stopId);
}

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
};

export async function fetchKmbEtas(plans: Array<{ stopId: string; route: string; serviceType: string }>) {
  const response = await fetch("/api/kmb/etas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ plans }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load ETAs: ${response.status}`);
  }

  const json = (await response.json()) as {
    eta: KmbEtaEntry[];
    errors?: Array<{ stopId: string; route: string; serviceType: string }>;
  };

  return json;
}

export async function fetchKmbRouteInfo(params: {
  route: string;
  direction: "I" | "O" | "inbound" | "outbound" | string;
  serviceType: string;
}): Promise<KmbRouteInfoLite> {
  const query = new URLSearchParams();
  query.set("route", params.route);
  query.set("direction", params.direction);
  query.set("serviceType", params.serviceType);

  const response = await fetch(`/api/kmb/route?${query.toString()}`);

  if (!response.ok) {
    throw new Error(`Failed to load route info: ${response.status}`);
  }

  const json = (await response.json()) as {
    data: {
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
  };

  return {
    route: json.data.route,
    bound: json.data.bound,
    serviceType: String(json.data.service_type),
    origin: {
      en: (json.data.orig_en ?? "").trim(),
      tc: (json.data.orig_tc ?? "").trim(),
      sc: (json.data.orig_sc ?? "").trim(),
    },
    destination: {
      en: (json.data.dest_en ?? "").trim(),
      tc: (json.data.dest_tc ?? "").trim(),
      sc: (json.data.dest_sc ?? "").trim(),
    },
  };
}

/**
 * Fetch ETAs for multiple stops using the new stop-eta API.
 * Much more efficient than per-route ETA calls.
 */
export type KmbStopEtasResponse = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>;
  faresByVariantKey?: Record<string, { hkd: number; dayCode?: number; source: "td-fare" }>;
  errors: string[];
  cached: number;
  fetched: number;
};

export async function fetchKmbStopEtas(
  stopIds: string[],
  options?: { routeFilter?: string; signal?: AbortSignal }
): Promise<KmbStopEtasResponse> {
  const response = await fetch("/api/kmb/stop-etas", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      stopIds,
      routeFilter: options?.routeFilter,
    }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load stop ETAs: ${response.status}`);
  }

  return (await response.json()) as KmbStopEtasResponse;
}

/**
 * Fetch schedules for multiple MTR stations in one request.
 */
export type MtrSchedulesResponse = {
  byKey: Record<string, MtrScheduleResponse>;
  errors: string[];
  cached: number;
  fetched: number;
  backoff: boolean;
};

export async function fetchMtrSchedules(
  queries: Array<{ line: string; sta: string; lang: "EN" | "TC" }>,
  options?: { signal?: AbortSignal }
): Promise<MtrSchedulesResponse> {
  const response = await fetch("/api/mtr/schedules", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ queries }),
    signal: options?.signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to load MTR schedules: ${response.status}`);
  }

  return (await response.json()) as MtrSchedulesResponse;
}
