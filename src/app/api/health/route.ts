import { getEtaDbCacheSnapshot, getEtaDbCached } from "@/lib/hkbus/cache";
import { internalError, ok } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    await getEtaDbCached();
    const cache = getEtaDbCacheSnapshot();

    return ok({
      service: "eta-api",
      status: "ok",
      timestamp: new Date().toISOString(),
      cache,
    });
  } catch {
    return internalError("Health check failed");
  }
}
