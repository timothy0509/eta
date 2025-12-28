import { NextResponse } from "next/server";
import { z } from "zod";

import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getKmbEta } from "@/lib/eta/kmb";
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
    const results = await promisePool(plans, 10, async (p) => {
      const eta = await getKmbEta(p);
      return { plan: p, eta };
    });

    const eta = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => (r.status === "fulfilled" ? r.value.eta : []));

    const errors = results
      .map((r, idx) => ({ r, idx }))
      .filter((x) => x.r.status === "rejected")
      .slice(0, 10)
      .map((x) => {
        const plan = plans[x.idx];
        return {
          stopId: plan.stopId,
          route: plan.route,
          serviceType: plan.serviceType,
        };
      });

    return NextResponse.json(
      {
        eta,
        errors,
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
