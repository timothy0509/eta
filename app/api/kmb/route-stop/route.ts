import { NextResponse } from "next/server";

import { getKmbRouteStops } from "@/lib/eta/kmb";

export async function GET() {
  const data = await getKmbRouteStops();
  return NextResponse.json({ data });
}
