import type { TransportMode } from './types'

export type SignalState = 'now' | 'soon' | 'later' | 'lost'

export const SIGNAL_URGENCY = {
  NOW_MAX_MIN: 3,
  SOON_MAX_MIN: 12,
} as const

export { STALE_THRESHOLDS_MS } from './stale'
export type { StaleMode } from './stale'

export function getSignalForMinutes(min: number | null, stale: boolean): SignalState {
  if (stale) return 'lost'
  if (min === null || Number.isNaN(min)) return 'lost'
  if (min <= SIGNAL_URGENCY.NOW_MAX_MIN) return 'now'
  if (min <= SIGNAL_URGENCY.SOON_MAX_MIN) return 'soon'
  return 'later'
}

export const MODE_TOKENS: Record<TransportMode, string> = {
  kmb: 'var(--mode-kmb)',
  mtr: 'var(--mode-mtr)',
  lrt: 'var(--mode-lrt)',
}

export function getModeToken(mode: TransportMode): string {
  return MODE_TOKENS[mode]
}

export function isTransportMode(value: unknown): value is TransportMode {
  return value === 'kmb' || value === 'mtr' || value === 'lrt'
}

export const SIGNAL_TOKENS: Record<SignalState | 'alert', string> = {
  now: 'var(--signal-now)',
  soon: 'var(--signal-soon)',
  later: 'var(--signal-later)',
  lost: 'var(--signal-lost)',
  alert: 'var(--signal-alert)',
}

export const SIGNAL_WASH_TOKENS: Record<SignalState | 'alert', string> = {
  now: 'var(--signal-now-wash)',
  soon: 'var(--signal-soon-wash)',
  later: 'var(--signal-later-wash)',
  lost: 'var(--signal-lost-wash)',
  alert: 'var(--signal-alert-wash)',
}

export function getSignalToken(signal: SignalState | 'alert'): string {
  return SIGNAL_TOKENS[signal]
}

export function getSignalWashToken(signal: SignalState | 'alert'): string {
  return SIGNAL_WASH_TOKENS[signal]
}
