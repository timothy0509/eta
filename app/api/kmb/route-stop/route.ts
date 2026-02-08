import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { listKmbRouteStops } from "@/lib/eta/hk-bus-eta";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { NextResponse } from "next/server";

export async function GET() {
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const data = await listKmbRouteStops();

    return NextResponse.json(
      {
        data: data.map((entry) => ({
          co: entry.co,
          route: entry.route,
          bound: entry.bound,
          service_type: entry.serviceType,
          seq: entry.seq,
          stop: entry.stopId,
        })),
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
        error: "Failed to load KMB route-stop",
      },
      {
        status,
      }
    );
  }
}
