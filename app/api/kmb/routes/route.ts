import { NextResponse } from "next/server";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { getKmbRouteList } from "@/lib/eta/kmb";

export async function GET() {
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const routes = await getKmbRouteList();

    return NextResponse.json(
      {
        routes,
      },
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
        error: "Failed to load KMB routes",
      },
      {
        status,
      }
    );
  }
}
