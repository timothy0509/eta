import { fetchKmbEtasForStop } from "@/lib/eta/hk-bus-eta";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { promisePool } from "@/lib/eta/promise-pool";
import { NextResponse } from "next/server";
import { z } from "zod";

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
      const eta = await fetchKmbEtasForStop({
        stopId,
        language: "tc",
      });
      return { stopId, eta };
    });

    const byStopId = new Map<string, Awaited<ReturnType<typeof fetchKmbEtasForStop>>>();
    for (const r of stopResults) {
      if (r.status !== "fulfilled") continue;
      byStopId.set(r.value.stopId, r.value.eta);
    }

    const eta = plans.flatMap((p) => {
      const stopEta = byStopId.get(p.stopId) ?? [];
      const route = p.route.toUpperCase();
      const now = new Date().toISOString();
      return stopEta
        .filter(
          (entry) =>
            String(entry.route ?? "").toUpperCase() === route &&
            String(entry.serviceType ?? "") === p.serviceType
        )
        .map((entry, idx) => ({
          co: "kmb",
          route: entry.route,
          dir: entry.dir,
          service_type: entry.serviceType,
          seq: entry.seq,
          stop: p.stopId,
          dest_en: entry.dest?.en ?? "",
          dest_tc: entry.dest?.zh ?? "",
          dest_sc: entry.dest?.zh ?? "",
          eta_seq: entry.etaSeq ?? idx + 1,
          eta: entry.eta ?? "",
          rmk_en: entry.remark?.en ?? "",
          rmk_tc: entry.remark?.zh ?? "",
          rmk_sc: entry.remark?.zh ?? "",
          data_timestamp: now,
        }));
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
