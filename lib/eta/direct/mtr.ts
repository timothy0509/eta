import { fetchJson } from '@/lib/eta/http'
import { mtrScheduleKey } from '@/lib/eta/cache/keys'
import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { promisePool } from '@/lib/eta/promise-pool'
import { getCachedValue } from '@/lib/eta/direct/shared'

const MTR_BASE_URL = 'https://rt.data.gov.hk'
const MTR_CONCURRENCY = 3
const BACKOFF_DURATION_MS = 15_000
const BACKOFF_STALE_MAX_MS = 20_000
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
}): Promise<MtrScheduleResponse> {
  const url = new URL(`${MTR_BASE_URL}/v1/transport/mtr/getSchedule.php`)
  url.searchParams.set('line', params.line)
  url.searchParams.set('sta', params.sta)
  url.searchParams.set('lang', params.lang)

  return await fetchJson<MtrScheduleResponse>(url.toString(), {
    cache: 'no-store',
    timeoutMs: 10_000,
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
  queries: Array<{ line: string; sta: string; lang: MtrLang }>
): Promise<MtrSchedulesResponse> {
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

  const results = await promisePool(uniqueList, MTR_CONCURRENCY, async (q) => {
    const resultKey = `${q.line}-${q.sta}-${q.lang}`
    const cacheKey = mtrScheduleKey({ line: q.line, sta: q.sta, lang: q.lang })

    const cachedValue = await getCachedValue<MtrScheduleResponse>({
      key: cacheKey,
      policyKey: 'mtrSchedule',
      policy: CACHE_POLICIES.mtrSchedule,
      allowStale: inBackoff,
      staleMaxMs: BACKOFF_STALE_MAX_MS,
      fetcher: async () => {
        if (inBackoff) {
          throw new Error('Rate limited - in backoff')
        }
        return await getMtrSchedule(q)
      },
    })

    if (cachedValue.cached) cached += 1
    if (!cachedValue.cached) fetched += 1

    return { key: resultKey, schedule: cachedValue.value }
  })

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const query = uniqueList[i]
    const key = `${query.line}-${query.sta}-${query.lang}`

    if (result.status === 'rejected') {
      const reason = result.reason as { status?: number } | undefined
      if (reason && typeof reason.status === 'number' && reason.status === 429) {
        const newBackoffUntil = Date.now() + BACKOFF_DURATION_MS
        setBackoffUntil(newBackoffUntil)
        broadcastBackoff(newBackoffUntil)
        sawRateLimit = true
      }
      errors.push(key)
      continue
    }

    byKey[result.value.key] = result.value.schedule
  }

  return {
    byKey,
    errors,
    cached,
    fetched,
    backoff: inBackoff || sawRateLimit,
  }
}
