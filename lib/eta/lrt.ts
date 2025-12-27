import { fetchJson } from "@/lib/eta/http";

const MTR_BASE_URL = "https://rt.data.gov.hk";

export type LrtScheduleResponse = {
  system_time?: string;
  platform_list?: Array<{
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

export async function getLrtSchedule(params: {
  stationId: string;
}): Promise<LrtScheduleResponse> {
  const url = new URL(`${MTR_BASE_URL}/v1/transport/mtr/lrt/getSchedule`);
  url.searchParams.set("station_id", params.stationId);

  return await fetchJson<LrtScheduleResponse>(url.toString(), {
    cache: "no-store",
  });
}
