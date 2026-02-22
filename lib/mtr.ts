import { MTR_LINES, MTR_STATION_NAME_BY_CODE } from "@/data/mtr-lines";
import { parseTime } from "@/lib/time";

export type MtrEta = {
  time: string;
  platform: string;
  destinationCode: string;
  destination: string;
  sequence: string;
  timetype?: string;
  route?: string;
};

export type MtrNormalizedResponse = {
  status: "ok" | "empty" | "error";
  message: string;
  isDelay: boolean | null;
  lastUpdated: string | null;
  line: { code: string; name: string };
  station: { code: string; name: string };
  up: MtrEta[];
  down: MtrEta[];
};

type MtrRawEta = {
  plat?: string;
  time?: string;
  dest?: string;
  seq?: string;
  timetype?: string;
  route?: string;
};

type MtrRawResponse = {
  status?: number | string;
  message?: string;
  url?: string;
  curr_time?: string;
  sys_time?: string;
  isdelay?: string;
  Isdelay?: string;
  data?: Record<
    string,
    {
      curr_time?: string;
      sys_time?: string;
      UP?: MtrRawEta[];
      DOWN?: MtrRawEta[];
    }
  >;
};

function normalizeEntries(entries: MtrRawEta[] = []): MtrEta[] {
  const normalized = entries
    .filter((entry) => entry.time && entry.time !== "-")
    .map((entry) => ({
      time: entry.time ?? "",
      platform: entry.plat ?? "",
      destinationCode: entry.dest ?? "",
      destination: entry.dest
        ? MTR_STATION_NAME_BY_CODE[entry.dest] ?? entry.dest
        : "",
      sequence: entry.seq ?? "",
      timetype: entry.timetype,
      route: entry.route,
    }));

  return normalized.sort((a, b) => {
    const timeA = parseTime(a.time)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const timeB = parseTime(b.time)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return timeA - timeB;
  });
}

function getLineMeta(line: string) {
  return MTR_LINES.find((entry) => entry.code === line) ?? {
    code: line,
    name: line,
  };
}

export function normalizeMtrResponse(
  payload: MtrRawResponse,
  line: string,
  station: string,
): MtrNormalizedResponse {
  const statusValue = String(payload.status ?? "0");
  const isDelayRaw = payload.isdelay ?? payload.Isdelay;
  const isDelay =
    isDelayRaw === "Y" ? true : isDelayRaw === "N" ? false : null;
  const lineMeta = getLineMeta(line);
  const stationName = MTR_STATION_NAME_BY_CODE[station] ?? station;

  if (statusValue !== "1") {
    return {
      status: "error",
      message: payload.message ?? "Service unavailable.",
      isDelay,
      lastUpdated: payload.curr_time ?? payload.sys_time ?? null,
      line: lineMeta,
      station: { code: station, name: stationName },
      up: [],
      down: [],
    };
  }

  const key = `${line}-${station}`;
  const stationData = payload.data?.[key];
  const up = normalizeEntries(stationData?.UP ?? []);
  const down = normalizeEntries(stationData?.DOWN ?? []);
  const hasData = up.length > 0 || down.length > 0;

  return {
    status: hasData ? "ok" : "empty",
    message: payload.message ?? (hasData ? "" : "No ETA available yet."),
    isDelay,
    lastUpdated: payload.curr_time ?? payload.sys_time ?? null,
    line: lineMeta,
    station: { code: station, name: stationName },
    up,
    down,
  };
}
