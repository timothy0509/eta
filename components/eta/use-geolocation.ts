'use client'

import * as React from 'react'

export type GeoLocation = { lat: number; lng: number }

export type GeolocationErrorCode = 'denied' | 'unavailable' | 'timeout' | 'unsupported'

export type UseGeolocationReturn = {
  location: GeoLocation | null
  loading: boolean
  error: GeolocationErrorCode | null
  refresh: () => void
}

const LAST_LOCATION_KEY = 'eta:last-location'
const MAX_CACHED_AGE_MS = 24 * 60 * 60 * 1000

function isValidLocation(value: unknown): value is GeoLocation {
  if (typeof value !== 'object' || value === null) return false
  const { lat, lng } = value as { lat: unknown; lng: unknown }
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  )
}

function readCachedLocation(): GeoLocation | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LAST_LOCATION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { lat: unknown; lng: unknown; at: unknown }
    if (!isValidLocation(parsed)) return null
    if (typeof parsed.at !== 'number' || Date.now() - parsed.at > MAX_CACHED_AGE_MS) return null
    return { lat: parsed.lat, lng: parsed.lng }
  } catch {
    return null
  }
}

function writeCachedLocation(location: GeoLocation) {
  try {
    window.localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ ...location, at: Date.now() }))
  } catch {
    // Storage full or blocked, location still works for this session.
  }
}

function readGeolocationErrorCode(err: unknown): GeolocationErrorCode {
  if (typeof err === 'object' && err !== null && 'code' in err) {
    const code = (err as { code: unknown }).code
    if (code === 1) return 'denied'
    if (code === 2) return 'unavailable'
    if (code === 3) return 'timeout'
  }
  if (err instanceof Error && /not supported/i.test(err.message)) return 'unsupported'
  return 'unavailable'
}

function requestPosition(options: PositionOptions): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      const err = { code: 0 }
      reject(Object.assign(new Error('Geolocation is not supported by this browser.'), err))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude })
      },
      (err) => reject(err),
      options
    )
  })
}

async function requestWithRetry(): Promise<GeoLocation> {
  try {
    return await requestPosition({ enableHighAccuracy: false, timeout: 10000, maximumAge: 30000 })
  } catch (err) {
    const code = readGeolocationErrorCode(err)
    if (code !== 'timeout' && code !== 'unavailable') throw err
    return await requestPosition({ enableHighAccuracy: true, timeout: 10000, maximumAge: 0 })
  }
}

async function isPermissionGranted(): Promise<boolean> {
  try {
    const permissions = (
      navigator as Navigator & {
        permissions?: { query: (q: { name: string }) => Promise<{ state: string }> }
      }
    ).permissions
    if (!permissions) return false
    const status = await permissions.query({ name: 'geolocation' })
    return status.state === 'granted'
  } catch {
    return false
  }
}

/**
 * Browser geolocation with a cached last fix, permission-aware auto-request,
 * and one high-accuracy retry. Errors are stable codes so views can translate them.
 */
export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = React.useState<GeoLocation | null>(() => readCachedLocation())
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<GeolocationErrorCode | null>(null)
  const seqRef = React.useRef(0)

  const refresh = React.useCallback(() => {
    const seq = (seqRef.current += 1)
    setLoading(true)
    setError(null)
    requestWithRetry()
      .then((next) => {
        if (seq !== seqRef.current) return
        if (!isValidLocation(next)) throw new Error('Invalid coordinates in geolocation fix.')
        setLocation(next)
        writeCachedLocation(next)
      })
      .catch((err) => {
        if (seq !== seqRef.current) return
        setError(readGeolocationErrorCode(err))
      })
      .finally(() => {
        if (seq === seqRef.current) setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    let cancelled = false
    isPermissionGranted().then((granted) => {
      if (cancelled || !granted) return
      refresh()
    })
    return () => {
      cancelled = true
    }
  }, [refresh])

  const memoizedLocation = React.useMemo(
    () => (location ? { lat: location.lat, lng: location.lng } : null),
    [location]
  )

  return { location: memoizedLocation, loading, error, refresh }
}
