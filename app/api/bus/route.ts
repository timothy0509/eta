import { NextRequest, NextResponse } from "next/server";
import { getRouteEtas, getRouteStopData, searchRoutes } from "@/lib/bus";

export const runtime = "nodejs";

function getLanguage(param: string | null) {
  return param?.toLowerCase() === "tc" ? "zh" : "en";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (!action) {
    return NextResponse.json(
      { status: "error", message: "Missing action." },
      { status: 400 },
    );
  }

  try {
    if (action === "search") {
      const query = searchParams.get("query") ?? "";
      const language = getLanguage(searchParams.get("lang"));
      const routes = await searchRoutes(query, language);

      return NextResponse.json({ status: "ok", routes });
    }

    if (action === "stops") {
      const routeId = searchParams.get("routeId") ?? "";
      const language = getLanguage(searchParams.get("lang"));

      if (!routeId) {
        return NextResponse.json(
          { status: "error", message: "Invalid route." },
          { status: 400 },
        );
      }

      const stopData = await getRouteStopData(routeId, language);
      if (!stopData) {
        return NextResponse.json(
          { status: "error", message: "Route not found." },
          { status: 404 },
        );
      }

      return NextResponse.json({ status: "ok", ...stopData });
    }

    if (action === "eta") {
      const routeId = searchParams.get("routeId") ?? "";
      const seqParam = searchParams.get("seq");
      const language = getLanguage(searchParams.get("lang"));

      if (!routeId || seqParam === null) {
        return NextResponse.json(
          { status: "error", message: "Invalid ETA request." },
          { status: 400 },
        );
      }

      const seq = Number(seqParam);
      if (!Number.isFinite(seq)) {
        return NextResponse.json(
          { status: "error", message: "Invalid stop sequence." },
          { status: 400 },
        );
      }

      const etas = await getRouteEtas(routeId, seq, language);
      return NextResponse.json({ status: "ok", etas });
    }

    return NextResponse.json(
      { status: "error", message: "Unsupported action." },
      { status: 400 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      { status: "error", message },
      { status: 500 },
    );
  }
}
