import { fromError, ok } from "@/lib/api/response";
import { getRouteStops } from "@/lib/hkbus/service";
import { routeStopsQuerySchema } from "@/lib/validation/hkbus";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ routeId: string }> }
): Promise<Response> {
  try {
    const { routeId } = await context.params;
    const url = new URL(request.url);

    const query = routeStopsQuerySchema.parse({
      operator: url.searchParams.get("operator") ?? undefined,
    });

    const stops = await getRouteStops({
      routeId,
      operator: query.operator,
    });

    return ok({
      routeId,
      operator: query.operator,
      count: stops.length,
      stops,
    });
  } catch (err) {
    return fromError(err);
  }
}
