import { fetchJson } from "@/lib/eta/http";

const MTR_BASE_URL = "https://rt.data.gov.hk";

export type MtrLang = "EN" | "TC";

export type MtrScheduleResponse = {
  status: number;
  message?: string;
  url?: string;
  curr_time?: string;
  sys_time?: string;
  // data is keyed by "LINE-STA"
  data?: Record<
    string,
    {
      UP?: MtrTrainEntry[];
      DOWN?: MtrTrainEntry[];
    }
  >;
};

export type MtrTrainEntry = {
  ttnt?: string; // time to next train
  time?: string; // departure time
  dest?: string;
  seq?: string | number;
  timetype?: string;
  // plus other optional fields
  [key: string]: unknown;
};

export async function getMtrSchedule(params: {
  line: string;
  sta: string;
  lang: MtrLang;
}): Promise<MtrScheduleResponse> {
  const url = new URL(`${MTR_BASE_URL}/v1/transport/mtr/getSchedule.php`);
  url.searchParams.set("line", params.line);
  url.searchParams.set("sta", params.sta);
  url.searchParams.set("lang", params.lang);

  return await fetchJson<MtrScheduleResponse>(url.toString(), {
    cache: "no-store",
    timeoutMs: 10_000,
  });
}
