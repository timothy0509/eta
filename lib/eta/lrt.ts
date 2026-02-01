import { fetchLrtEtasForStop, listLrtRoutes } from "@/lib/eta/hk-bus-eta";
export type LrtScheduleResponse = {
  system_time?: string;
  platform_list?: Array<{
    end_service_status?: number | string | boolean;
    platform_id: number;
    route_list: Array<{
      train_length: number;
      arrival_departure: "A" | "D" | string;
      dest_en: string;
      dest_ch: string;
      time_en: string;
      time_ch: string;
      route_no: string;
      stop: number;
    }>;
  }>;
};

type LrtRouteEntry = {
  platform_id: number;
  route_no: string;
  dest_en: string;
  dest_ch: string;
  time_en: string;
  time_ch: string;
  train_length: number;
  arrival_departure: "A" | "D" | string;
  stop: number;
};

function formatHkDateTime(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const lookup = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${lookup.year}-${lookup.month}-${lookup.day} ${lookup.hour}:${lookup.minute}:${lookup.second}`;
}

function mapEtaToRouteEntry(params: {
  eta: { eta: string; remark: { en: string; zh: string }; dest: { en: string; zh: string } };
  route: string;
  dest: { en: string; zh: string };
  platformId: number;
}): LrtRouteEntry {
  const etaDate = params.eta.eta ? new Date(params.eta.eta) : null;
  const isValid = etaDate instanceof Date && !Number.isNaN(etaDate.getTime());
  const minutes = isValid ? Math.round((etaDate.getTime() - Date.now()) / 60000) : null;

  let timeEn = "-";
  let timeCh = "-";
  if (minutes !== null) {
    if (minutes <= 0) {
      timeEn = "Arriving";
      timeCh = "即將到達";
    } else {
      timeEn = String(minutes);
      timeCh = `${minutes} 分`;
    }
  }

  const remark = params.eta.remark;
  const trainMatch = remark.en.match(/▭+/) ?? remark.zh.match(/▭+/);
  const trainLength = trainMatch?.[0] ? trainMatch[0].length : 1;

  return {
    platform_id: params.platformId,
    route_no: params.route,
    dest_en: params.dest.en || params.eta.dest.en || "",
    dest_ch: params.dest.zh || params.eta.dest.zh || "",
    time_en: timeEn,
    time_ch: timeCh,
    train_length: trainLength,
    arrival_departure: minutes !== null && minutes <= 0 ? "A" : "D",
    stop: 0,
  };
}

export async function getLrtSchedule(params: {
  stationId: string;
}): Promise<LrtScheduleResponse> {
  const routes = await listLrtRoutes();
  const stationId = String(params.stationId).padStart(3, "0");
  const stopId = `LR${stationId}`;
  const destByRoute = new Map(
    routes.map((entry) => [entry.route.toUpperCase(), entry.dest])
  );

  const variants = routes.filter((entry) => {
    const stops = entry.stops.lightRail ?? [];
    return stops.some((id) => id.toUpperCase() === stopId.toUpperCase());
  });

  if (variants.length === 0) {
    return {
      system_time: formatHkDateTime(new Date()),
      platform_list: [],
    };
  }

  const platformMap = new Map<number, LrtRouteEntry[]>();

  const results = await Promise.all(
    variants.map(async (entry) => {
      const bound = entry.bound.lightRail ?? "";
      const stop = entry.stops.lightRail?.find((id) => id.toUpperCase() === stopId.toUpperCase()) ?? stopId;
      const stationIdForEta = stop.startsWith("LR") ? stop.slice(2) : params.stationId;
      const etas = await fetchLrtEtasForStop({
        route: entry.route,
        bound,
        serviceType: entry.serviceType,
        stationId: stationIdForEta,
        language: "tc",
      });

      return etas.flatMap((eta) => {
        const hasEta = Boolean(eta.eta);
        const hasDest = Boolean(eta.dest?.en || eta.dest?.zh);
        if (!hasEta && !hasDest) {
          return [] as LrtRouteEntry[];
        }
        const remark = eta.remark?.en ?? "";
        const platformMatch = remark.match(/Platform\s+(\d+)/i) || remark.match(/(\d+)\s*號月台/);
        const platformId = platformMatch?.[1] ? Number(platformMatch[1]) : 0;
        return [
          mapEtaToRouteEntry({
            eta,
            route: entry.route,
            dest: destByRoute.get(entry.route.toUpperCase()) ?? entry.dest,
            platformId,
          }),
        ];
      });
    })
  );

  for (const entries of results) {
    for (const entry of entries) {
      if (!entry.platform_id) continue;
      const list = platformMap.get(entry.platform_id) ?? [];
      list.push(entry);
      platformMap.set(entry.platform_id, list);
    }
  }

  const platformList = Array.from(platformMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([platform_id, route_list]) => ({
      platform_id,
      route_list,
    }));

  return {
    system_time: formatHkDateTime(new Date()),
    platform_list: platformList,
  };
}
