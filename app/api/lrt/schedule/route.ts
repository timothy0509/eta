import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getLrtSchedule, type LrtScheduleResponse } from "@/lib/eta/lrt";
import { lrtScheduleCache } from "@/lib/eta/cache";

const QuerySchema = z.object({
  stationId: z.string().trim().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    stationId: url.searchParams.get("stationId"),
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
    const cacheKey = `lrt:${parsed.data.stationId}`;

    // Try cache first
    const cachedData = lrtScheduleCache.get(cacheKey) as LrtScheduleResponse | undefined;
    if (cachedData !== undefined) {
      return NextResponse.json({ schedule: cachedData, cached: true });
    }

    const schedule = await getLrtSchedule(parsed.data);
    lrtScheduleCache.set(cacheKey, schedule);

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
        error: "Failed to load LRT schedule",
      },
      {
        status,
      }
    );
  }
}
