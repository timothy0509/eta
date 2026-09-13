'use client'

import { useEffect, useState } from 'react'

import { fetchTdTraffic } from '@/lib/eta/client'
import type { TdTrafficRecord } from '@/lib/eta/direct/td-traffic'
import type { UiLanguage } from '@/lib/eta/types'

export type TdTrafficAlert = TdTrafficRecord & {
  /** View-all link to the TD Special Traffic News page. */
  link: string
}

export type TrafficAlertsResult = {
  alerts: TdTrafficAlert[]
  error: string | null
}

export type UseTdTrafficAlertsState = TrafficAlertsResult & {
  loading: boolean
}

const TD_SPECIAL_TRAFFIC_NEWS: Record<UiLanguage, string> = {
  en: 'https://www.td.gov.hk/en/special_news/spnews.htm',
  tc: 'https://www.td.gov.hk/tc/special_news/spnews.htm',
  sc: 'https://www.td.gov.hk/sc/special_news/spnews.htm',
}

export function getTdTrafficNewsUrl(lang: UiLanguage): string {
  return TD_SPECIAL_TRAFFIC_NEWS[lang] ?? TD_SPECIAL_TRAFFIC_NEWS.en
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Failed to load traffic alerts'
}

/**
 * Live TD Special Traffic News with the TD page kept only as the view-all
 * link on each item. Never throws. Aborted requests resolve without an error.
 */
export async function fetchTdTrafficAlerts(
  lang: UiLanguage,
  options?: { signal?: AbortSignal }
): Promise<TrafficAlertsResult> {
  try {
    const records = await fetchTdTraffic(lang, options)
    const link = getTdTrafficNewsUrl(lang)
    return { alerts: records.map((record) => ({ ...record, link })), error: null }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { alerts: [], error: null }
    }
    return { alerts: [], error: toErrorMessage(error) }
  }
}

const INITIAL_STATE: UseTdTrafficAlertsState = { alerts: [], loading: true, error: null }

/** Live traffic alerts with loading and error states for the banner UI. */
export function useTdTrafficAlerts(lang: UiLanguage): UseTdTrafficAlertsState {
  const [activeLang, setActiveLang] = useState(lang)
  const [state, setState] = useState<UseTdTrafficAlertsState>(INITIAL_STATE)

  if (activeLang !== lang) {
    setActiveLang(lang)
    setState(INITIAL_STATE)
  }

  useEffect(() => {
    const controller = new AbortController()
    fetchTdTrafficAlerts(lang, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) {
          setState({ alerts: result.alerts, loading: false, error: result.error })
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setState({ alerts: [], loading: false, error: toErrorMessage(error) })
        }
      })
    return () => {
      controller.abort()
    }
  }, [lang])

  return state
}
