import { NextResponse } from "next/server";

import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { getKmbRouteStops } from "@/lib/eta/kmb";

export async function GET() {
  const data = await getKmbRouteStops();
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
