import { fetchJson } from "@/lib/eta/http";

const KMB_BASE_URL = "https://data.etabus.gov.hk";

export type KmbApiEnvelope<T> = {
  type: string;
  version: string;
  generated_timestamp?: string;
  data: T;
};

export type KmbStop = {
  stop: string;
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
  eta: string; // ISO timestamp, may be empty
  rmk_en: string;
  rmk_tc: string;
  rmk_sc: string;
  data_timestamp: string;
};

export async function getKmbStops(): Promise<KmbStop[]> {
  const json = await fetchJson<KmbApiEnvelope<KmbStop[]>>(
    `${KMB_BASE_URL}/v1/transport/kmb/stop`,
    {
      next: {
        revalidate: 60 * 60 * 12,
      },
    }
  );
  return json.data;
}

export async function getKmbEta(params: {
  stopId: string;
  route: string;
  serviceType: string;
}): Promise<KmbEtaEntry[]> {
  const json = await fetchJson<KmbApiEnvelope<KmbEtaEntry[]>>(
    `${KMB_BASE_URL}/v1/transport/kmb/eta/${encodeURIComponent(params.stopId)}/${encodeURIComponent(params.route)}/${encodeURIComponent(params.serviceType)}`,
    {
      cache: "no-store",
    }
  );
  return json.data;
}

export type KmbRouteStopEntry = {
  route: string;
  bound: "I" | "O" | string;
  service_type: number | string;
  seq: number | string;
  stop: string;
};

export async function getKmbRouteStops(): Promise<KmbRouteStopEntry[]> {
  const json = await fetchJson<KmbApiEnvelope<KmbRouteStopEntry[]>>(
    `${KMB_BASE_URL}/v1/transport/kmb/route-stop`,
    {
      next: {
        revalidate: 60 * 60 * 12,
      },
    }
  );
  return json.data;
}

export type KmbRouteInfo = {
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

export async function getKmbRouteInfo(params: {
  route: string;
  direction: "I" | "O" | "inbound" | "outbound" | string;
  serviceType: string;
}): Promise<KmbRouteInfo> {
  const direction =
    params.direction === "I"
      ? "inbound"
      : params.direction === "O"
        ? "outbound"
        : params.direction;

  const json = await fetchJson<KmbApiEnvelope<KmbRouteInfo>>(
    `${KMB_BASE_URL}/v1/transport/kmb/route/${encodeURIComponent(params.route)}/${encodeURIComponent(direction)}/${encodeURIComponent(params.serviceType)}`,
    {
      next: {
        revalidate: 60 * 60 * 24,
      },
    }
  );
  return json.data;
}
