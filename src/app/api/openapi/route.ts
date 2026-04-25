import { ok } from "@/lib/api/response";
import { getOpenApiSchema } from "@/lib/api/openapi";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return ok(getOpenApiSchema());
}
