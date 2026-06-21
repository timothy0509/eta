'use client'

import * as React from 'react'

export type GeoLocation = { lat: number; lng: number }

export type UseGeolocationReturn = {
  location: GeoLocation | null
  loading: boolean
  error: string | null
  refresh: () => void
}

function readGeolocationError(err: GeolocationPositionError): string {
  let message = 'Unable to retrieve your location.'
  if (err.code === err.PERMISSION_DENIED) {
    message = 'Location permission was denied.'
  } else if (err.code === err.POSITION_UNAVAILABLE) {
    message = 'Location information is unavailable.'
  } else if (err.code === err.TIMEOUT) {
    message = 'The location request timed out.'
  }
  return message
}

function requestGeoLocation(): Promise<GeoLocation> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (err) => {
        reject(new Error(readGeolocationError(err)))
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    )
  })
}

/**
 * Requests the browser's current geolocation and exposes it as a memoized value.
 * The hook automatically requests location on mount and provides a `refresh`
 * function to request it again.
 */
export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = React.useState<GeoLocation | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    setLoading(true)
    setError(null)
    requestGeoLocation()
      .then(setLocation)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to get location'))
      .finally(() => setLoading(false))
  }, [])

  React.useEffect(() => {
    requestGeoLocation()
      .then(setLocation)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to get location'))
      .finally(() => setLoading(false))
  }, [])

  const memoizedLocation = React.useMemo(
    () => (location ? { lat: location.lat, lng: location.lng } : null),
    [location]
  )

  return { location: memoizedLocation, loading, error, refresh }
}
