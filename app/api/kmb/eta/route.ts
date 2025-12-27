import { NextResponse } from "next/server";

import { getKmbEta } from "@/lib/eta/kmb";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const stopId = url.searchParams.get("stopId");
  const route = url.searchParams.get("route");
  const serviceType = url.searchParams.get("serviceType") ?? "1";

  if (!stopId || !route) {
    return NextResponse.json(
      {
        error: "Missing required query params: stopId, route",
      },
      {
        status: 400,
      }
    );
  }

  const eta = await getKmbEta({ stopId, route, serviceType });

  return NextResponse.json({
    eta,
  });
}
