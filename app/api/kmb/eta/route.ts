import { fetchKmbEtasForStop } from "@/lib/eta/hk-bus-eta";
import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { KMB_NO_STORE_HEADERS } from "@/lib/eta/kmb-cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  stopId: z.string().trim().min(1),
  route: z.string().trim().min(1),
  serviceType: z.string().trim().min(1).default("1"),
  co: z.string().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    stopId: url.searchParams.get("stopId"),
    route: url.searchParams.get("route"),
    serviceType: url.searchParams.get("serviceType") ?? "1",
    co: url.searchParams.get("co") ?? undefined,
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
    const now = new Date().toISOString();
    const eta = await fetchKmbEtasForStop({
      stopId: parsed.data.stopId,
      route: parsed.data.route,
      serviceType: parsed.data.serviceType,
      language: "tc",
    });

    return NextResponse.json(
      {
        eta: eta
          .filter((entry) => (parsed.data.co ? entry.co === parsed.data.co : true))
          .map((entry) => ({
            co: entry.co ?? "kmb",
            route: entry.route,
            dir: entry.dir,
            service_type: entry.serviceType,
            seq: entry.seq,
            stop: parsed.data.stopId,
            dest_en: entry.dest?.en ?? "",
            dest_tc: entry.dest?.zh ?? "",
            dest_sc: entry.dest?.zh ?? "",
            eta_seq: entry.etaSeq,
            eta: entry.eta ?? "",
            rmk_en: entry.remark?.en ?? "",
            rmk_tc: entry.remark?.zh ?? "",
            rmk_sc: entry.remark?.zh ?? "",
            data_timestamp: now,
          })),
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
