import { NextResponse } from "next/server";

import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { getKmbRouteList } from "@/lib/eta/kmb";

export async function GET() {
  const routes = await getKmbRouteList();
  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

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
}
