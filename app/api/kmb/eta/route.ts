import { NextResponse } from "next/server";
import { z } from "zod";

import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getKmbStopEta } from "@/lib/eta/kmb";

const QuerySchema = z.object({
  stopId: z.string().trim().min(1),
  route: z.string().trim().min(1),
  serviceType: z.string().trim().min(1).default("1"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    stopId: url.searchParams.get("stopId"),
    route: url.searchParams.get("route"),
    serviceType: url.searchParams.get("serviceType") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
      },
      {
        status: 400,
        headers: KMB_NO_STORE_HEADERS,
      }
    );
  }

  try {
    // Prefer stop-level ETA API (much fewer upstream calls).
    // Filter by route+serviceType to preserve old response shape.
    const stopEta = await getKmbStopEta(parsed.data.stopId);
    const route = parsed.data.route.toUpperCase();
    const eta = stopEta.filter(
      (entry) =>
        String(entry.route ?? "").toUpperCase() === route &&
        String(entry.service_type ?? "") === parsed.data.serviceType
    );

    return NextResponse.json(
      {
        eta,
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
      {
        error: "Failed to load KMB ETA",
      },
      {
        status,
        headers: KMB_NO_STORE_HEADERS,
      }
    );
  }
}
