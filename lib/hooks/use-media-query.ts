'use client'

import * as React from 'react'

type Options = {
  defaultValue?: boolean
}

function getMatch(query: string) {
  if (typeof window === 'undefined') return false
  return window.matchMedia(query).matches
}

function subscribe(query: string, callback: () => void) {
  const media = window.matchMedia(query)
  const handler = () => callback()
  if (media.addEventListener) {
    media.addEventListener('change', handler)
    return () => media.removeEventListener('change', handler)
  }
  media.addListener(handler)
  return () => media.removeListener(handler)
}

export function useMediaQuery(query: string, options?: Options) {
  const defaultValue = options?.defaultValue ?? false
  return React.useSyncExternalStore(
    (callback) => subscribe(query, callback),
    () => getMatch(query),
    () => defaultValue
  )
}
