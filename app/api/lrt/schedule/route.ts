import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getLrtSchedule } from "@/lib/eta/lrt";

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
    const schedule = await getLrtSchedule(parsed.data);
    return NextResponse.json({ schedule });
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
