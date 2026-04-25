import { ETA_DB_CACHE_KEY } from './constants'
import type { EtaDbState } from './types'

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function readEtaDbCache() {
  if (!canUseStorage()) {
    return null
  }

  const raw = window.localStorage.getItem(ETA_DB_CACHE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as EtaDbState
    if (!parsed.db || !parsed.md5 || !parsed.fetchedAt) {
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function writeEtaDbCache(cache: EtaDbState) {
  if (!canUseStorage()) {
    return
  }

  window.localStorage.setItem(ETA_DB_CACHE_KEY, JSON.stringify(cache))
}
