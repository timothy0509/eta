import { NextResponse } from "next/server";

import { getLrtSchedule } from "@/lib/eta/lrt";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const stationId = url.searchParams.get("stationId");

  if (!stationId) {
    return NextResponse.json(
      {
        error: "Missing required query params: stationId",
      },
      {
        status: 400,
      }
    );
  }

  const schedule = await getLrtSchedule({ stationId });
  return NextResponse.json({ schedule });
}
