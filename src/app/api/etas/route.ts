import { NextResponse } from "next/server";
import { z } from "zod";

import { getEtaDb, getEtas } from "~/lib/eta-store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  routeId: z.string().min(1),
  company: z.string().min(1),
  seq: z.number().int().nonnegative(),
  language: z.enum(["zh", "en"]),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload" },
      { status: 400 }
    );
  }

  const { routeId, company, seq, language } = parsed.data;
  const etaDb = await getEtaDb();
  const route = etaDb.routeList[routeId];

  if (!route) {
    return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const stops = route.stops[company];
  if (!stops) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  if (seq >= stops.length) {
    return NextResponse.json({ error: "Stop out of range" }, { status: 400 });
  }

  const routeForCompany = {
    ...route,
    co: [company],
    stops: { [company]: stops },
    bound: { [company]: route.bound[company] },
  };

  const etas = await getEtas({
    ...routeForCompany,
    seq,
    language,
  });

  return NextResponse.json({
    etas,
    updatedAt: Date.now(),
  });
}
