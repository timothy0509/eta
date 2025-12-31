import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getMtrSchedule, type MtrScheduleResponse } from "@/lib/eta/mtr";
import { mtrScheduleCache } from "@/lib/eta/cache";

const QuerySchema = z.object({
  line: z.string().trim().min(1),
  sta: z.string().trim().min(1),
  lang: z.enum(["EN", "TC"]).default("EN"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    line: url.searchParams.get("line"),
    sta: url.searchParams.get("sta"),
    lang: url.searchParams.get("lang") ?? "EN",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
      },
      {
        status: 400,
      }
    );
  }

  try {
    const cacheKey = `mtr:${parsed.data.line}:${parsed.data.sta}:${parsed.data.lang}`;

    // Try cache first
    const cachedData = mtrScheduleCache.get(cacheKey) as MtrScheduleResponse | undefined;
    if (cachedData !== undefined) {
      return NextResponse.json({ schedule: cachedData, cached: true });
    }

    const schedule = await getMtrSchedule(parsed.data);
    mtrScheduleCache.set(cacheKey, schedule);

    return NextResponse.json({ schedule, cached: false });
  } catch (error) {
    const status =
      error instanceof UpstreamTimeoutError
        ? 504
        : error instanceof ApiError
          ? 502
          : 500;

    return NextResponse.json(
      {
        error: "Failed to load MTR schedule",
      },
      {
        status,
      }
    );
  }
}
