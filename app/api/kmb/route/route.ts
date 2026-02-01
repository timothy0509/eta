import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { findKmbRouteInfo } from "@/lib/eta/hk-bus-eta";
import { kmbDailyCacheControlHeader, secondsUntilNextKmbDailyUpdate } from "@/lib/eta/kmb-cache";
import { NextResponse } from "next/server";
import { z } from "zod";

const QuerySchema = z.object({
  route: z.string().trim().min(1),
  direction: z.string().trim().min(1),
  serviceType: z.string().trim().min(1).default("1"),
});

export async function GET(request: Request) {
  const url = new URL(request.url);

  const parsed = QuerySchema.safeParse({
    route: url.searchParams.get("route"),
    direction: url.searchParams.get("direction"),
    serviceType: url.searchParams.get("serviceType") ?? "1",
  });

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid query params",
      },
      {
        status: 400,
      }
    );
  }

  const revalidateSeconds = secondsUntilNextKmbDailyUpdate();

  try {
    const bound =
      parsed.data.direction === "I"
        ? "I"
        : parsed.data.direction === "O"
          ? "O"
          : parsed.data.direction;
    const data = await findKmbRouteInfo({
      route: parsed.data.route,
      bound,
      serviceType: parsed.data.serviceType,
    });

    if (!data) {
      return NextResponse.json(
        {
          error: "KMB route not found",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json(
      {
        data: {
          route: data.route,
          bound: data.bound,
          service_type: data.serviceType,
          orig_en: data.origin.en,
          orig_tc: data.origin.tc,
          orig_sc: data.origin.sc,
          dest_en: data.destination.en,
          dest_tc: data.destination.tc,
          dest_sc: data.destination.sc,
        },
      },
      {
        headers: {
          "Cache-Control": kmbDailyCacheControlHeader(revalidateSeconds),
        },
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
        error: "Failed to load KMB route info",
      },
      {
        status,
      }
    );
  }
}
