export type FetchJsonOptions = Omit<RequestInit, 'signal' | 'headers'> & {
  cache?: RequestCache
  next?: NextFetchRequestConfig
  signal?: AbortSignal
  timeoutMs?: number
  headers?: HeadersInit
  /**
   * Retries after the first attempt. Defaults to 1, so slow networks get
   * one more chance on timeout or 5xx. Set to 0 to disable.
   */
  retries?: number
  retryDelayMs?: number
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export class UpstreamTimeoutError extends Error {
  constructor(message = 'Upstream timeout') {
    super(message)
    this.name = 'UpstreamTimeoutError'
  }
}

function sanitizeUpstreamBody(body: string): string {
  const trimmed = body.trim()
  if (!trimmed) return ''

  // Avoid returning HTML/error pages directly to clients.
  if (trimmed.startsWith('<') || trimmed.toLowerCase().includes('<html')) {
    return ''
  }

  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}…` : trimmed
}

type EffectiveNetworkType = 'slow-2g' | '2g' | '3g' | '4g' | 'unknown'

function getNetworkInfo(): { saveData: boolean; effectiveType: EffectiveNetworkType } {
  if (typeof navigator === 'undefined') return { saveData: false, effectiveType: 'unknown' }
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }
  ).connection
  const saveData = connection?.saveData === true
  const raw = String(connection?.effectiveType ?? '').toLowerCase()
  const effectiveType: EffectiveNetworkType =
    raw === 'slow-2g' || raw === '2g' || raw === '3g' || raw === '4g' ? raw : 'unknown'
  return { saveData, effectiveType }
}

function isWeakNetwork(): boolean {
  const { saveData, effectiveType } = getNetworkInfo()
  if (saveData) return true
  return effectiveType === 'slow-2g' || effectiveType === '2g' || effectiveType === '3g'
}

export function isWeakNetworkConnection(): boolean {
  return isWeakNetwork()
}

export function getEffectiveNetworkType(): EffectiveNetworkType {
  return getNetworkInfo().effectiveType
}

export function getAdaptiveConcurrency(fast: number, medium: number, slow: number): number {
  if (typeof navigator === 'undefined') return fast
  const { saveData, effectiveType } = getNetworkInfo()
  if (saveData || effectiveType === 'slow-2g' || effectiveType === '2g') return slow
  if (effectiveType === '3g') return medium
  return fast
}

export type TimeoutKind = 'live' | 'prefetch' | 'route'

const TIMEOUT_DEFAULTS_MS: Record<TimeoutKind, { fast: number; weak: number }> = {
  live: { fast: 8_000, weak: 15_000 },
  prefetch: { fast: 6_000, weak: 6_000 },
  route: { fast: 12_000, weak: 8_000 },
}

export function resolveTimeoutMs(kind: TimeoutKind = 'live'): number {
  const defaults = TIMEOUT_DEFAULTS_MS[kind]
  return isWeakNetwork() ? defaults.weak : defaults.fast
}

function shouldRetry(error: unknown): boolean {
  if (error instanceof UpstreamTimeoutError) return true
  if (error instanceof ApiError) {
    if (error.status === 408 || error.status === 429) return true
    return error.status >= 500 && error.status <= 599
  }
  return false
}

function jitteredDelay(baseMs: number): number {
  return Math.round(baseMs * (0.5 + Math.random() * 0.5))
}

async function fetchJsonOnce<T>(url: string, options: FetchJsonOptions): Promise<T> {
  const controller = new AbortController()
  const timeoutMs = options.timeoutMs ?? resolveTimeoutMs('live')
  const timeout = timeoutMs
    ? setTimeout(() => controller.abort(new UpstreamTimeoutError()), timeoutMs)
    : null

  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal

  const headers = new Headers(options.headers)
  if (!headers.has('accept')) {
    headers.set('accept', 'application/json')
  }

  try {
    const response = await fetch(url, {
      method: options.method,
      body: options.body,
      credentials: options.credentials,
      mode: options.mode,
      redirect: options.redirect,
      referrer: options.referrer,
      referrerPolicy: options.referrerPolicy,
      integrity: options.integrity,
      keepalive: options.keepalive,
      cache: options.cache,
      next: options.next,
      signal,
      headers,
    })

    if (!response.ok) {
      const bodyText = sanitizeUpstreamBody(await response.text().catch(() => ''))
      throw new ApiError(
        `HTTP ${response.status} from upstream${bodyText ? `: ${bodyText}` : ''}`,
        response.status
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new UpstreamTimeoutError()
    }
    throw error
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export async function fetchJson<T>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const retries = options.retries ?? 1
  const retryDelayMs = options.retryDelayMs ?? 800
  const attempts = Math.max(1, retries + 1)

  let lastError: unknown = null
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (options.signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }
    try {
      return await fetchJsonOnce(url, options)
    } catch (error) {
      lastError = error
      const callerAborted = options.signal?.aborted === true
      const canRetry = !callerAborted && attempt + 1 < attempts && shouldRetry(error)
      if (!canRetry) throw error
      await new Promise((resolve) => setTimeout(resolve, jitteredDelay(retryDelayMs)))
    }
  }
  throw lastError
}
