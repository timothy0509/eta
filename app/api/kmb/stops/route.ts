import { NextResponse } from "next/server";

import { getKmbStops } from "@/lib/eta/kmb";

export async function GET() {
  const stops = await getKmbStops();
  return NextResponse.json({
    stops,
  });
}
