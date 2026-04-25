import type { Company } from 'hk-bus-eta'

import type { Language } from './types'

export const BUS_COMPANIES = [
  'kmb',
  'nlb',
  'ctb',
  'lrtfeeder',
  'gmb',
  'lightRail',
  'mtr',
  'sunferry',
  'hkkf',
  'fortuneferry',
] as const

export const ETA_DB_CACHE_KEY = 'eta.hk.bus.db.v1'
export const ETA_DB_CACHE_TTL_MS = 1000 * 60 * 60 * 24
export const DEFAULT_LANGUAGE: Language = 'en'

export const COMPANY_PRIORITY: Company[] = [
  'kmb',
  'ctb',
  'nlb',
  'gmb',
  'lrtfeeder',
  'lightRail',
  'mtr',
  'sunferry',
  'fortuneferry',
  'hkkf',
]
