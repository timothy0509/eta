import { fromError, ok } from "@/lib/api/response";
import { getRoutes } from "@/lib/hkbus/service";
import { routeSearchQuerySchema } from "@/lib/validation/hkbus";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const params = routeSearchQuerySchema.parse({
      query: url.searchParams.get("query") ?? undefined,
      operator: url.searchParams.get("operator") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
    });

    const routes = await getRoutes(params);

    return ok({
      query: params.query ?? null,
      operator: params.operator ?? null,
      limit: params.limit,
      count: routes.length,
      routes,
    });
  } catch (err) {
    return fromError(err);
  }
}
