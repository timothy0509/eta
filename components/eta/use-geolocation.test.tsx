'use client'

import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useGeolocation } from './use-geolocation'

const LAST_LOCATION_KEY = 'eta:last-location'

function stubPermissions(state: string) {
  Object.defineProperty(window.navigator, 'permissions', {
    value: { query: vi.fn().mockResolvedValue({ state }) },
    configurable: true,
    writable: true,
  })
}

type PositionCallbacks = {
  onSuccess: PositionCallback
  onError?: PositionErrorCallback | null
}

function stubGeolocation(
  handler: (call: number, callbacks: PositionCallbacks, options?: PositionOptions) => void
) {
  const seenOptions: Array<PositionOptions | undefined> = []
  let calls = 0
  const getCurrentPosition = vi.fn(
    (
      onSuccess: PositionCallback,
      onError?: PositionErrorCallback | null,
      options?: PositionOptions
    ) => {
      calls += 1
      seenOptions.push(options)
      handler(calls, { onSuccess, onError }, options)
    }
  )
  Object.defineProperty(window.navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
    writable: true,
  })
  return { getCurrentPosition, seenOptions }
}

function successAt(lat: number, lng: number): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng } } as GeolocationPosition
}

function errorWithCode(code: number): GeolocationPositionError {
  return {
    code,
    message: 'mock',
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError
}

beforeEach(() => {
  window.localStorage.clear()
  stubPermissions('prompt')
})

afterEach(() => {
  vi.restoreAllMocks()
  window.localStorage.clear()
})

describe('useGeolocation', () => {
  it('returns the cached fix without prompting', async () => {
    window.localStorage.setItem(
      LAST_LOCATION_KEY,
      JSON.stringify({ lat: 22.3, lng: 114.16, at: Date.now() })
    )
    const { getCurrentPosition } = stubGeolocation(() => {})

    const { result } = renderHook(() => useGeolocation())

    expect(result.current.location).toEqual({ lat: 22.3, lng: 114.16 })
    expect(result.current.loading).toBe(false)
    await act(async () => {})
    expect(getCurrentPosition).not.toHaveBeenCalled()
  })

  it('retries once with high accuracy after a timeout, then succeeds', async () => {
    const { seenOptions } = stubGeolocation((call, { onSuccess, onError }) => {
      if (call === 1) {
        onError?.(errorWithCode(3))
      } else {
        onSuccess(successAt(22.28, 114.15))
      }
    })

    const { result } = renderHook(() => useGeolocation())

    expect(result.current.location).toBeNull()

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.location).toEqual({ lat: 22.28, lng: 114.15 })
    })
    expect(seenOptions).toHaveLength(2)
    expect(seenOptions[1]).toMatchObject({ enableHighAccuracy: true, maximumAge: 0 })
    expect(result.current.error).toBeNull()
    expect(window.localStorage.getItem(LAST_LOCATION_KEY)).toContain('22.28')
  })

  it('maps a denial to the denied code without retrying', async () => {
    const { getCurrentPosition } = stubGeolocation((_call, { onError }) => {
      onError?.(errorWithCode(1))
    })

    const { result } = renderHook(() => useGeolocation())

    act(() => {
      result.current.refresh()
    })

    await waitFor(() => {
      expect(result.current.error).toBe('denied')
    })
    expect(result.current.location).toBeNull()
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })
})
