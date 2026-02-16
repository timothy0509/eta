import { NextResponse } from "next/server";

import { getEtaDb } from "~/lib/eta-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const etaDb = await getEtaDb();
  return NextResponse.json({
    routeList: etaDb.routeList,
    stopList: etaDb.stopList,
    holidays: etaDb.holidays,
  });
}
