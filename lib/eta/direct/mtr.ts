import { fetchJson, getAdaptiveConcurrency, resolveTimeoutMs } from '@/lib/eta/http'
import { mtrScheduleKey } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { promisePool } from '@/lib/eta/promise-pool'
import { getCachedValue } from '@/lib/eta/direct/shared'

const MTR_BASE_URL = 'https://rt.data.gov.hk'
const MTR_CONCURRENCY_FAST = 3
const MTR_CONCURRENCY_MEDIUM = 2
const MTR_CONCURRENCY_SLOW = 1
const BACKOFF_BASE_MS = 15_000
const BACKOFF_MAX_MS = 60_000
const BACKOFF_FAILURES_KEY = 'timoeta:mtr-backoff-failures'
const BACKOFF_STORAGE_KEY = 'timoeta:mtr-backoff-until'
const BACKOFF_CHANNEL_NAME = 'timoeta:mtr-backoff'

function getBackoffUntil(): number {
  if (typeof window === 'undefined') return 0
  try {
    const stored = sessionStorage.getItem(BACKOFF_STORAGE_KEY)
    if (stored) {
      const timestamp = Number(stored)
      if (Date.now() < timestamp) return timestamp
      sessionStorage.removeItem(BACKOFF_STORAGE_KEY)
    }
  } catch {
    // sessionStorage may be unavailable in some environments
  }
  return 0
}

function setBackoffUntil(timestamp: number): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(BACKOFF_STORAGE_KEY, String(timestamp))
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

function getBackoffFailures(): number {
  if (typeof window === 'undefined') return 0
  try {
    const stored = sessionStorage.getItem(BACKOFF_FAILURES_KEY)
    const count = Number(stored ?? 0)
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  } catch {
    return 0
  }
}

function setBackoffFailures(count: number): void {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(BACKOFF_FAILURES_KEY, String(Math.max(0, Math.floor(count))))
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

function nextBackoffDurationMs(): number {
  const failures = getBackoffFailures()
  const duration = BACKOFF_BASE_MS * 2 ** Math.min(failures, 2)
  return Math.min(duration, BACKOFF_MAX_MS)
}

function recordBackoffHit(): number {
  const duration = nextBackoffDurationMs()
  const until = Date.now() + duration
  setBackoffUntil(until)
  setBackoffFailures(getBackoffFailures() + 1)
  broadcastBackoff(until)
  return until
}

function clearBackoff(): void {
  setBackoffFailures(0)
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(BACKOFF_STORAGE_KEY)
  } catch {
    // sessionStorage may be unavailable in some environments
  }
}

let backoffChannel: BroadcastChannel | null = null
function getBackoffChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined') return null
  if (!backoffChannel) {
    try {
      backoffChannel = new BroadcastChannel(BACKOFF_CHANNEL_NAME)
      backoffChannel.onmessage = (event) => {
        if (event.data?.type === 'backoff' && event.data?.timestamp) {
          setBackoffUntil(event.data.timestamp)
        }
      }
    } catch {
      // BroadcastChannel may be unavailable
    }
  }
  return backoffChannel
}

function broadcastBackoff(timestamp: number): void {
  const channel = getBackoffChannel()
  if (channel) {
    try {
      channel.postMessage({ type: 'backoff', timestamp })
    } catch {
      // ignore
    }
  }
}

export type MtrLang = 'EN' | 'TC'

export type MtrScheduleResponse = {
  status: number
  message?: string
  url?: string
  curr_time?: string
  sys_time?: string
  data?: Record<
    string,
    {
      UP?: MtrTrainEntry[]
      DOWN?: MtrTrainEntry[]
    }
  >
}

export type MtrTrainEntry = {
  ttnt?: string
  time?: string
  dest?: string
  seq?: string | number
  timetype?: string
  [key: string]: unknown
}

export async function getMtrSchedule(params: {
  line: string
  sta: string
  lang: MtrLang
  signal?: AbortSignal
}): Promise<MtrScheduleResponse> {
  const url = new URL(`${MTR_BASE_URL}/v1/transport/mtr/getSchedule.php`)
  url.searchParams.set('line', params.line)
  url.searchParams.set('sta', params.sta)
  url.searchParams.set('lang', params.lang)

  return await fetchJson<MtrScheduleResponse>(url.toString(), {
    cache: 'no-store',
    timeoutMs: resolveTimeoutMs('live'),
    signal: params.signal,
  })
}

export type MtrSchedulesResponse = {
  byKey: Record<string, MtrScheduleResponse>
  errors: string[]
  cached: number
  fetched: number
  backoff: boolean
}

export async function fetchMtrSchedules(
  queries: Array<{ line: string; sta: string; lang: MtrLang }>,
  options?: { signal?: AbortSignal }
): Promise<MtrSchedulesResponse> {
  if (options?.signal?.aborted) {
    throw new DOMException('The operation was aborted.', 'AbortError')
  }
  const signal = options?.signal
  const uniqueQueries = new Map<string, { line: string; sta: string; lang: MtrLang }>()
  for (const q of queries) {
    const key = `${q.line}-${q.sta}-${q.lang}`
    if (!uniqueQueries.has(key)) {
      uniqueQueries.set(key, { line: q.line, sta: q.sta, lang: q.lang })
    }
  }

  const uniqueList = Array.from(uniqueQueries.values())
  const now = Date.now()
  const inBackoff = now < getBackoffUntil()

  const byKey: Record<string, MtrScheduleResponse> = {}
  const errors: string[] = []
  let cached = 0
  let fetched = 0
  let sawRateLimit = false

  const results = await promisePool(
    uniqueList,
    getAdaptiveConcurrency(MTR_CONCURRENCY_FAST, MTR_CONCURRENCY_MEDIUM, MTR_CONCURRENCY_SLOW),
    async (q) => {
      const resultKey = `${q.line}-${q.sta}-${q.lang}`
      const cacheKey = mtrScheduleKey({ line: q.line, sta: q.sta, lang: q.lang })

      const cachedValue = await getCachedValue<MtrScheduleResponse>({
        key: cacheKey,
        policyKey: 'mtrSchedule',
        policy: CACHE_POLICIES.mtrSchedule,
        allowStale: true,
        signal,
        fetcher: async () => {
          if (inBackoff) {
            throw new Error('Rate limited - in backoff')
          }
          return await getMtrSchedule({ ...q, signal })
        },
      })

      if (cachedValue.cached) cached += 1
      if (!cachedValue.cached) fetched += 1

      return { key: resultKey, schedule: cachedValue.value }
    },
    { signal }
  )

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const query = uniqueList[i]
    const key = `${query.line}-${query.sta}-${query.lang}`

    if (result.status === 'rejected') {
      const reason = result.reason as { status?: number } | undefined
      const rateLimited =
        reason &&
        typeof reason.status === 'number' &&
        (reason.status === 429 || reason.status >= 500)
      if (rateLimited) {
        recordBackoffHit()
        sawRateLimit = true
      }
      errors.push(key)
      continue
    }

    byKey[result.value.key] = result.value.schedule
  }

  if (errors.length === 0 && fetched > 0) {
    clearBackoff()
  }

  return {
    byKey,
    errors,
    cached,
    fetched,
    backoff: inBackoff || sawRateLimit,
  }
}
