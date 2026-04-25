import { BUS_COMPANIES } from "@/lib/hkbus/constants";
import { ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return ok({
    operators: BUS_COMPANIES,
  });
}
