import { NextRequest, NextResponse } from "next/server";
import { isValidLine, isValidStationForLine } from "@/data/mtr-lines";
import { normalizeMtrResponse } from "@/lib/mtr";

export const runtime = "nodejs";

function getLanguage(param: string | null) {
  return param?.toLowerCase() === "tc" ? "TC" : "EN";
}

function errorPayload(line: string, station: string, message: string) {
  return {
    status: "error",
    message,
    isDelay: null,
    lastUpdated: null,
    line: { code: line, name: line || "" },
    station: { code: station, name: station || "" },
    up: [],
    down: [],
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const line = searchParams.get("line") ?? "";
  const station = searchParams.get("station") ?? "";
  const lang = getLanguage(searchParams.get("lang"));

  if (!line || !station) {
    return NextResponse.json(
      errorPayload(line, station, "Missing line or station."),
      { status: 400 },
    );
  }

  if (!isValidLine(line) || !isValidStationForLine(line, station)) {
    return NextResponse.json(
      errorPayload(line, station, "Invalid line/station combination."),
      { status: 400 },
    );
  }

  const url = new URL("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php");
  url.searchParams.set("line", line);
  url.searchParams.set("sta", station);
  url.searchParams.set("lang", lang);

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      return NextResponse.json(
        errorPayload(line, station, "MTR service unavailable."),
        { status: response.status },
      );
    }

    const payload = await response.json();
    const normalized = normalizeMtrResponse(payload, line, station);

    return NextResponse.json(normalized, {
      headers: {
        "Cache-Control": "s-maxage=10, stale-while-revalidate=20",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return NextResponse.json(
      errorPayload(line, station, message),
      { status: 500 },
    );
  }
}
