import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { listKmbRoutes } from "@/lib/eta/hk-bus-eta";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { NextResponse } from "next/server";

export async function GET() {
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const routes = await listKmbRoutes();

    return NextResponse.json(
      {
        routes: routes.map((entry) => ({
          co: entry.co,
          route: entry.route,
          bound: entry.bound,
          service_type: entry.serviceType,
          orig_en: entry.origin.en,
          orig_tc: entry.origin.tc,
          orig_sc: entry.origin.sc,
          dest_en: entry.destination.en,
          dest_tc: entry.destination.tc,
          dest_sc: entry.destination.sc,
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
        error: "Failed to load KMB routes",
      },
      {
        status,
      }
    );
  }
}
