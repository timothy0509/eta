import { NextResponse } from "next/server";
import { z } from "zod";

import { ApiError, UpstreamTimeoutError } from "@/lib/eta/http";
import { getMtrSchedule, type MtrScheduleResponse } from "@/lib/eta/mtr";
import { promisePool } from "@/lib/eta/promise-pool";
import { mtrScheduleCache } from "@/lib/eta/cache";

const QuerySchema = z.object({
  line: z.string().trim().min(1),
  sta: z.string().trim().min(1),
  lang: z.enum(["EN", "TC"]).default("EN"),
});

const BodySchema = z.object({
  queries: z.array(QuerySchema).min(1).max(20),
});

// Concurrency limit for MTR upstream calls (avoid 429)
const MTR_CONCURRENCY = 3;

// Backoff state for 429 handling
let backoffUntil = 0;
const BACKOFF_DURATION_MS = 30_000; // 30 seconds

/**
 * POST /api/mtr/schedules
 *
 * Fetches schedules for multiple MTR stations in one request.
 * Dedupes requests and applies concurrency limiting + micro-caching.
 *
 * Request body:
 * {
 *   queries: Array<{ line: string, sta: string, lang?: "EN" | "TC" }>
 * }
 *
 * Response:
 * {
 *   byKey: Record<string, MtrScheduleResponse>,  // keyed by "LINE-STA"
 *   errors: string[],  // keys that failed
 *   cached: number,
 *   fetched: number,
 *   backoff: boolean   // true if we're in backoff mode
 * }
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 400 }
    );
  }

  // Dedupe queries by LINE-STA-lang
  const uniqueQueries = new Map<string, { line: string; sta: string; lang: "EN" | "TC" }>();
  for (const q of parsed.data.queries) {
    const key = `${q.line}-${q.sta}-${q.lang}`;
    if (!uniqueQueries.has(key)) {
      uniqueQueries.set(key, { line: q.line, sta: q.sta, lang: q.lang });
    }
  }

  const queries = Array.from(uniqueQueries.values());

  // Check if we're in backoff mode
  const now = Date.now();
  const inBackoff = now < backoffUntil;

  try {
    const byKey: Record<string, MtrScheduleResponse> = {};
    const errors: string[] = [];
    let cached = 0;
    let fetched = 0;

    const results = await promisePool(queries, MTR_CONCURRENCY, async (q) => {
      const resultKey = `${q.line}-${q.sta}`;
      const cacheKey = `mtr:${q.line}:${q.sta}:${q.lang}`;

      // Try cache first
      const cachedData = mtrScheduleCache.get(cacheKey) as MtrScheduleResponse | undefined;
      if (cachedData !== undefined) {
        cached++;
        return { key: resultKey, schedule: cachedData, fromCache: true };
      }

      // If in backoff, don't make upstream calls
      if (inBackoff) {
        throw new Error("Rate limited - in backoff");
      }

      // Fetch from upstream
      try {
        const schedule = await getMtrSchedule(q);
        mtrScheduleCache.set(cacheKey, schedule);
        fetched++;
        return { key: resultKey, schedule, fromCache: false };
      } catch (error) {
        // Check for 429 and set backoff
        if (error instanceof ApiError && error.status === 429) {
          backoffUntil = Date.now() + BACKOFF_DURATION_MS;
        }
        throw error;
      }
    });

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const query = queries[i];
      const key = `${query.line}-${query.sta}`;

      if (result.status === "rejected") {
        errors.push(key);
        continue;
      }

      byKey[result.value.key] = result.value.schedule;
    }

    return NextResponse.json({
      byKey,
      errors,
      cached,
      fetched,
      backoff: inBackoff,
    });
  } catch (error) {
    const status =
      error instanceof UpstreamTimeoutError
        ? 504
        : error instanceof ApiError
          ? error.status === 429 ? 429 : 502
          : 500;

    return NextResponse.json(
      { error: "Failed to load MTR schedules" },
      { status }
    );
  }
}
