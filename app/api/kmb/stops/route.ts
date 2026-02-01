import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { listKmbStops } from "@/lib/eta/hk-bus-eta";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { NextResponse } from "next/server";

export async function GET() {
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const stops = await listKmbStops();

    return NextResponse.json(
      {
        stops: stops.map((stop) => ({
          stop: stop.stopId,
          name_en: stop.nameEn,
          name_tc: stop.nameTc,
          name_sc: stop.nameSc,
          lat: stop.lat,
          long: stop.lng,
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
        error: "Failed to load KMB stops",
      },
      {
        status,
      }
    );
  }
}
