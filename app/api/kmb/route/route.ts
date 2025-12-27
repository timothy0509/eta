import { NextResponse } from "next/server";

import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { getKmbRouteInfo } from "@/lib/eta/kmb";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const route = url.searchParams.get("route");
  const direction = (url.searchParams.get("direction") ?? "") as "I" | "O" | string;
  const serviceType = url.searchParams.get("serviceType") ?? "1";

  if (!route || !direction) {
    return NextResponse.json(
      {
        error: "Missing required query params: route, direction",
      },
      {
        status: 400,
      }
    );
  }

  const data = await getKmbRouteInfo({ route, direction, serviceType });
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": kmbDailyCacheControlHeader(revalidateSeconds),
      },
    }
  );
}
