import { NextResponse } from "next/server";
import { z } from "zod";

import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getKmbStopEta, type KmbEtaEntry } from "@/lib/eta/kmb";
import { promisePool } from "@/lib/eta/promise-pool";

const BodySchema = z.object({
  plans: z
    .array(
      z.object({
        stopId: z.string().trim().min(1),
        route: z.string().trim().min(1),
        serviceType: z.string().trim().min(1).default("1"),
      })
    )
    .min(1)
    .max(80),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: KMB_NO_STORE_HEADERS }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400, headers: KMB_NO_STORE_HEADERS }
    );
  }

  const unique = new Map<string, (typeof parsed.data.plans)[number]>();
  for (const plan of parsed.data.plans) {
    const key = `${plan.stopId}|${plan.route.toUpperCase()}|${plan.serviceType}`;
    if (!unique.has(key)) unique.set(key, { ...plan, route: plan.route.toUpperCase() });
  }

  const plans = Array.from(unique.values()).slice(0, 80);

  try {
    // Prefer stop-level ETA API (much fewer upstream calls).
    // Fetch per stopId then filter by requested route+serviceType.
    const uniqueStopIds = Array.from(new Set(plans.map((p) => p.stopId)));

    const stopResults = await promisePool(uniqueStopIds, 10, async (stopId) => {
      const eta = await getKmbStopEta(stopId);
      return { stopId, eta };
    });

    const byStopId = new Map<string, KmbEtaEntry[]>();
    for (const r of stopResults) {
      if (r.status !== "fulfilled") continue;
      byStopId.set(r.value.stopId, r.value.eta);
    }

    const eta = plans.flatMap((p) => {
      const stopEta = byStopId.get(p.stopId) ?? [];
      const route = p.route.toUpperCase();
      return stopEta.filter(
        (entry) =>
          String(entry.route ?? "").toUpperCase() === route &&
          String(entry.service_type ?? "") === p.serviceType
      );
    });

    const errors = stopResults
      .map((r, idx) => ({ r, idx }))
      .filter((x) => x.r.status === "rejected")
      .slice(0, 10)
      .map((x) => uniqueStopIds[x.idx])
      .filter((stopId): stopId is string => Boolean(stopId));

    return NextResponse.json(
      {
        eta,
        errors: errors.map((stopId) => ({ stopId })),
      },
      {
        headers: KMB_NO_STORE_HEADERS,
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
      { error: "Failed to load KMB ETAs" },
      { status, headers: KMB_NO_STORE_HEADERS }
    );
  }
}
