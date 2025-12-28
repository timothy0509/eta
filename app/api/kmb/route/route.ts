import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { getKmbRouteInfo } from "@/lib/eta/kmb";

const QuerySchema = z.object({
  route: z.string().trim().min(1),
  direction: z.string().trim().min(1),
  serviceType: z.string().trim().min(1).default("1"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    route: url.searchParams.get("route"),
    direction: url.searchParams.get("direction"),
    serviceType: url.searchParams.get("serviceType") ?? "1",
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

  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const data = await getKmbRouteInfo(parsed.data);

    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": kmbDailyCacheControlHeader(revalidateSeconds),
        },
      }
    );
  } catch (error) {
    const status =
      error instanceof UpstreamTimeoutError
        ? 504
        : error instanceof ApiError
          ? 502
          : 500;

    return NextResponse.json(
      {
        error: "Failed to load KMB route info",
      },
      {
        status,
      }
    );
  }
}
