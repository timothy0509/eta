'use client'

import { X } from 'lucide-react'
import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import type { RouteFilterMode } from '@/lib/store'

export type RouteFilterEntry = {
  id: string
  variantKey: string
}

export type RouteFilterState = {
  routes?: string
  entries?: RouteFilterEntry[]
}

export type RouteFilterOption = {
  key: string // `${co}|${route}|${direction}|${serviceType}`
  route: string
  label: string
}

export function countActiveFilters(state: RouteFilterState): number {
  const entries = state.entries ?? []
  if (entries.length > 0) return entries.length

  const routes = (state.routes ?? '').trim()
  if (!routes) return 0

  return routes
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean).length
}

function getCompanyFromVariantKey(key: string) {
  const [co] = key.split('|')
  return co || 'kmb'
}

function hasDuplicateRoutes(options: RouteFilterOption[]): boolean {
  const routeCounts = new Map<string, number>()
  for (const opt of options) {
    const route = opt.route.toUpperCase()
    routeCounts.set(route, (routeCounts.get(route) ?? 0) + 1)
  }
  return Array.from(routeCounts.values()).some((count) => count > 1)
}

type Props = {
  lang: UiLanguage
  mode: RouteFilterMode
  onModeChange?: (mode: RouteFilterMode) => void
  value: RouteFilterState
  onChange: (value: RouteFilterState) => void
  options?: RouteFilterOption[]
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2, 10)
}

function sortOptions(options: RouteFilterOption[]) {
  return [...options].sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }))
}

export function RouteFilter({ lang, mode, value, onChange, options }: Props) {
  const opts = React.useMemo(() => sortOptions(options ?? []), [options])
  const showOperatorCode = React.useMemo(() => hasDuplicateRoutes(opts), [opts])

  const t = {
    routes: lang === 'en' ? 'Routes' : '路線',
    allRoutes:
      lang === 'en' ? 'All routes at this stop' : lang === 'sc' ? '此站所有路线' : '此站所有路線',
    noOptions:
      lang === 'en'
        ? 'Pick a stop to see available routes.'
        : lang === 'sc'
          ? '请选择车站以查看可用路线。'
          : '請選擇車站以查看可用路線。',
  }

  const selectedKeys = React.useMemo(() => {
    if (mode === 'advanced') {
      return new Set((value.entries ?? []).map((e) => e.variantKey))
    }
    const routes = (value.routes ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    return new Set(routes)
  }, [mode, value.entries, value.routes])

  const toggleOption = React.useCallback(
    (opt: RouteFilterOption) => {
      const entries = value.entries ?? []
      const exists = entries.some((e) => e.variantKey === opt.key)
      const next = exists
        ? entries.filter((e) => e.variantKey !== opt.key)
        : [...entries, { id: createId(), variantKey: opt.key }]
      onChange({ ...value, entries: next, routes: '' })
    },
    [onChange, value]
  )

  const clearAll = React.useCallback(() => {
    onChange({ routes: '', entries: [] })
  }, [onChange])

  const activeCount = countActiveFilters(value)

  return (
    <div className="bg-surface-container-low rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between gap-4">
        <div>
          <div className="m3-title-md">{t.routes}</div>
          <div className="text-on-surface-variant m3-body-md">
            {activeCount === 0 ? t.allRoutes : `${activeCount} ${t.routes}`}
          </div>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-on-surface-variant hover:text-on-surface m3-label-lg flex items-center gap-1 rounded-full px-2 py-1 transition-colors"
          >
            <X className="h-4 w-4" />
            {lang === 'en' ? 'Clear' : '清除'}
          </button>
        )}
      </div>

      {!opts.length ? (
        <div className="text-on-surface-variant m3-body-md bg-surface-container rounded-xl p-3 text-center">
          {t.noOptions}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {opts.map((opt) => {
            const active = selectedKeys.has(opt.key)
            const company = getCompanyFromVariantKey(opt.key)
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleOption(opt)}
                className={cn(
                  'm3-label-lg flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors',
                  active
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <RouteBadge route={opt.route} company={company} size="sm" />
                {showOperatorCode && (
                  <span className="text-on-surface-variant m3-label-sm uppercase">{company}</span>
                )}
                <span className="max-w-[12ch] truncate">{opt.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
