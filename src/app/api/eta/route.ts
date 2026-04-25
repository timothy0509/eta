import { fromError, ok } from "@/lib/api/response";
import { getEta } from "@/lib/hkbus/service";
import { etaQuerySchema } from "@/lib/validation/hkbus";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const query = etaQuerySchema.parse({
      routeId: url.searchParams.get("routeId") ?? undefined,
      operator: url.searchParams.get("operator") ?? undefined,
      seq: url.searchParams.get("seq") ?? undefined,
      lang: url.searchParams.get("lang") ?? undefined,
    });

    const etas = await getEta({
      routeId: query.routeId,
      operator: query.operator,
      seq: query.seq,
      lang: query.lang,
    });

    return ok({
      routeId: query.routeId,
      operator: query.operator,
      sequence: query.seq,
      language: query.lang,
      count: etas.length,
      etas,
    });
  } catch (err) {
    return fromError(err);
  }
}
