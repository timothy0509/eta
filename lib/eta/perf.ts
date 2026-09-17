// Lightweight performance marks plus an optional web-vitals sampler.
//
// No network calls live here: reporting is a caller-supplied callback, so the
// static build never gains a new beacon host. All helpers are best effort and
// safe to call during SSR.

export type PerfDetail = {
  mode?: string
  subView?: string
}

export type PerfReport = {
  name: string
  durationMs: number
} & PerfDetail

const MAX_REPORTS = 50
const reportBuffer: PerfReport[] = []

function now(): number {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now()
  }
  return Date.now()
}

function pushReport(report: PerfReport): void {
  reportBuffer.push(report)
  if (reportBuffer.length > MAX_REPORTS) {
    reportBuffer.splice(0, reportBuffer.length - MAX_REPORTS)
  }
}

/** Last N timing reports, newest last. Useful for debugging on device. */
export function getPerfReports(): PerfReport[] {
  return [...reportBuffer]
}

export function clearPerfReports(): void {
  reportBuffer.length = 0
}

export function markPerf(name: string): void {
  try {
    if (typeof performance !== 'undefined' && typeof performance.mark === 'function') {
      performance.mark(name)
    }
  } catch {
    // Marks are best effort (SSR, older browsers).
  }
}

/** Measure between a start mark and now. Returns duration or null. */
export function measurePerf(name: string, startMark?: string, detail?: PerfDetail): number | null {
  try {
    if (typeof performance === 'undefined' || typeof performance.measure !== 'function') {
      return null
    }
    const entry = startMark ? performance.measure(name, startMark) : performance.measure(name)
    pushReport({ name, durationMs: entry.duration, ...detail })
    return entry.duration
  } catch {
    return null
  }
}

/** Time an async operation and record the duration. Passes value through. */
export async function timeAsync<T>(
  name: string,
  fn: () => Promise<T>,
  detail?: PerfDetail
): Promise<T> {
  const start = now()
  try {
    return await fn()
  } finally {
    pushReport({ name, durationMs: now() - start, ...detail })
  }
}

export type WebVitalsSnapshot = {
  lcpMs: number | null
  cls: number | null
  inpMs: number | null
} & PerfDetail

type LayoutShiftEntry = PerformanceEntry & {
  value?: number
  hadRecentInput?: boolean
}

type EventTimingEntry = PerformanceEntry & {
  duration?: number
}

function shouldSkipSampler(): boolean {
  if (typeof window === 'undefined') return true
  try {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
    // Never spend observer budget on metered connections.
    if (connection?.saveData === true) return true
  } catch {
    return false
  }
  return false
}

let lastWebVitals: WebVitalsSnapshot | null = null

/** Last sampled web-vitals snapshot, if the sampler fired. */
export function getLastWebVitals(): WebVitalsSnapshot | null {
  return lastWebVitals ? { ...lastWebVitals } : null
}

function observeSafely(
  type: string,
  onEntry: (entry: PerformanceEntry) => void,
  observers: PerformanceObserver[]
): void {
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) onEntry(entry)
    })
    observer.observe({ type, buffered: true })
    observers.push(observer)
  } catch {
    // Entry type unsupported — skip it.
  }
}

/**
 * Sample LCP/CLS/INP once per page load at `sampleRate` (default 10%).
 * Calls `onReport` on pagehide with the snapshot. Returns a cleanup fn.
 */
export function initWebVitalsSampler(
  options?: {
    sampleRate?: number
    onReport?: (snapshot: WebVitalsSnapshot) => void
  } & PerfDetail
): () => void {
  const noop = () => {}
  if (shouldSkipSampler()) return noop
  if (Math.random() >= (options?.sampleRate ?? 0.1)) return noop
  if (typeof PerformanceObserver === 'undefined') return noop

  let lcpMs: number | null = null
  let cls = 0
  let sawShift = false
  let inpMs: number | null = null
  const observers: PerformanceObserver[] = []

  observeSafely(
    'largest-contentful-paint',
    (entry) => {
      lcpMs = entry.startTime
    },
    observers
  )

  observeSafely(
    'layout-shift',
    (entry) => {
      const shift = entry as LayoutShiftEntry
      if (shift.hadRecentInput !== true && typeof shift.value === 'number') {
        cls += shift.value
        sawShift = true
      }
    },
    observers
  )

  observeSafely(
    'event',
    (entry) => {
      const timing = entry as EventTimingEntry
      if (typeof timing.duration === 'number') {
        inpMs = inpMs === null ? timing.duration : Math.max(inpMs, timing.duration)
      }
    },
    observers
  )

  let reported = false
  const flush = () => {
    if (reported) return
    reported = true
    for (const observer of observers) {
      try {
        observer.disconnect()
      } catch {
        // Ignore disconnect errors.
      }
    }
    lastWebVitals = {
      lcpMs,
      cls: sawShift ? cls : null,
      inpMs,
      mode: options?.mode,
      subView: options?.subView,
    }
    options?.onReport?.({ ...lastWebVitals })
  }

  try {
    window.addEventListener('pagehide', flush, { once: true })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flush()
    })
  } catch {
    // Listeners are best effort.
  }

  return flush
}
