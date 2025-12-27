import { NextResponse } from "next/server";

import { getMtrSchedule } from "@/lib/eta/mtr";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const line = url.searchParams.get("line");
  const sta = url.searchParams.get("sta");
  const lang = (url.searchParams.get("lang") ?? "EN") as "EN" | "TC";

  if (!line || !sta) {
    return NextResponse.json(
      {
        error: "Missing required query params: line, sta",
      },
      {
        status: 400,
      }
    );
  }

  if (lang !== "EN" && lang !== "TC") {
    return NextResponse.json(
      {
        error: "Invalid lang. Supported: EN, TC",
      },
      {
        status: 400,
      }
    );
  }

  const schedule = await getMtrSchedule({ line, sta, lang });
  return NextResponse.json({ schedule });
}
