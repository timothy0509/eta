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

function getDirectionFromVariantKey(key: string) {
  const parts = key.split('|')
  return parts[2] ?? ''
}

function sortOptions(options: RouteFilterOption[]) {
  return [...options].sort((a, b) => a.route.localeCompare(b.route, undefined, { numeric: true }))
}

function groupOptionsByRoute(opts: RouteFilterOption[]): Map<string, RouteFilterOption[]> {
  const grouped = new Map<string, RouteFilterOption[]>()
  for (const opt of opts) {
    const route = opt.route.toUpperCase()
    const list = grouped.get(route)
    if (list) list.push(opt)
    else grouped.set(route, [opt])
  }
  return grouped
}

function isRouteActive(
  route: string,
  variants: RouteFilterOption[],
  selectedKeys: Set<string>,
  mode: RouteFilterMode
) {
  if (mode === 'advanced') {
    return variants.some((v) => selectedKeys.has(v.key))
  }
  return selectedKeys.has(route) || variants.some((v) => selectedKeys.has(v.key))
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

export function RouteFilter({ lang, mode, onModeChange, value, onChange, options }: Props) {
  const opts = React.useMemo(() => sortOptions(options ?? []), [options])
  const groupedByRoute = React.useMemo(() => groupOptionsByRoute(opts), [opts])
  const routeNumbers = React.useMemo(
    () =>
      Array.from(groupedByRoute.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true })
      ),
    [groupedByRoute]
  )

  const optsFingerprint = React.useMemo(() => opts.map((o) => o.key).join('\0'), [opts])

  const [focusState, setFocusState] = React.useState<{
    generation: string
    route: string | null
  }>({ generation: optsFingerprint, route: null })

  const focusedRouteRaw = focusState.generation === optsFingerprint ? focusState.route : null
  const focusedRoute =
    focusedRouteRaw && groupedByRoute.has(focusedRouteRaw) ? focusedRouteRaw : null

  const setFocusedRoute = React.useCallback(
    (route: string | null | ((prev: string | null) => string | null)) => {
      setFocusState((prev) => {
        const currentRoute = prev.generation === optsFingerprint ? prev.route : null
        const nextRoute = typeof route === 'function' ? route(currentRoute) : route
        return { generation: optsFingerprint, route: nextRoute }
      })
    },
    [optsFingerprint]
  )

  const t = {
    routes: lang === 'en' ? 'Routes' : '路線',
    noOptions:
      lang === 'en'
        ? 'Pick a stop to see available routes.'
        : lang === 'sc'
          ? '请选择车站以查看可用路线。'
          : '請選擇車站以查看可用路線。',
    clear: lang === 'en' ? 'Clear' : '清除',
    inbound: lang === 'en' ? 'Inbound' : '往',
    outbound: lang === 'en' ? 'Outbound' : '往',
  }

  const selectedKeys = React.useMemo(() => {
    const entryKeys = (value.entries ?? []).map((e) => e.variantKey).filter(Boolean)
    if (entryKeys.length > 0) {
      return new Set(entryKeys)
    }
    const routes = (value.routes ?? '')
      .split(',')
      .map((r) => r.trim())
      .filter(Boolean)
    return new Set(routes)
  }, [value.entries, value.routes])

  const toggleOption = React.useCallback(
    (opt: RouteFilterOption) => {
      const entries = value.entries ?? []
      const exists = entries.some((e) => e.variantKey === opt.key)
      const next = exists
        ? entries.filter((e) => e.variantKey !== opt.key)
        : [...entries, { id: createId(), variantKey: opt.key }]
      if (!exists && mode !== 'advanced') {
        onModeChange?.('advanced')
      }
      onChange({ ...value, entries: next, routes: '' })
    },
    [mode, onChange, onModeChange, value]
  )

  const clearAll = React.useCallback(() => {
    setFocusedRoute(null)
    onChange({ routes: '', entries: [] })
  }, [onChange, setFocusedRoute])

  const handleRouteClick = React.useCallback(
    (route: string, variants: RouteFilterOption[]) => {
      if (variants.length === 1) {
        toggleOption(variants[0]!)
        return
      }
      setFocusedRoute((prev) => (prev === route ? null : route))
    },
    [setFocusedRoute, toggleOption]
  )

  const activeCount = countActiveFilters(value)
  const focusedVariants = focusedRoute ? groupedByRoute.get(focusedRoute) : undefined
  const showVariantRow = Boolean(focusedVariants && focusedVariants.length > 1)
  const useScrollCap = routeNumbers.length > 16

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="m3-label-lg text-on-surface">{t.routes}</span>
          {activeCount > 0 && (
            <span className="bg-primary-container text-on-primary-container m3-label-sm rounded-full px-2 py-0.5">
              {activeCount}
            </span>
          )}
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high m3-label-md flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            {t.clear}
          </button>
        )}
      </div>

      {!opts.length ? (
        <p className="text-on-surface-variant m3-body-md rounded-2xl bg-[var(--surface-container)]/60 px-3 py-3 text-sm">
          {t.noOptions}
        </p>
      ) : (
        <>
          <div
            className={cn(
              'flex flex-wrap gap-1.5',
              useScrollCap && 'max-h-32 overflow-y-auto pr-1'
            )}
          >
            {routeNumbers.map((route) => {
              const variants = groupedByRoute.get(route) ?? []
              const company = getCompanyFromVariantKey(variants[0]?.key ?? '')
              const active = isRouteActive(route, variants, selectedKeys, mode)
              const focused = focusedRoute === route
              const tooltip = variants.map((v) => v.label).join(' · ')

              return (
                <button
                  key={route}
                  type="button"
                  title={tooltip}
                  onClick={() => handleRouteClick(route, variants)}
                  className={cn(
                    'inline-flex rounded-xl p-0.5 transition-all',
                    active && 'bg-primary-container shadow-sm',
                    focused && !active && 'bg-surface-container-high ring-primary/30 ring-2',
                    !active && !focused && 'hover:bg-surface-container-high'
                  )}
                >
                  <RouteBadge route={route} company={company} size="sm" />
                </button>
              )
            })}
          </div>

          {showVariantRow && focusedVariants ? (
            <div className="bg-surface-container/50 flex flex-wrap gap-1.5 rounded-2xl p-2">
              {focusedVariants.map((opt) => {
                const active = selectedKeys.has(opt.key)
                const direction = getDirectionFromVariantKey(opt.key)
                const directionHint =
                  direction === 'I' ? t.inbound : direction === 'O' ? t.outbound : null

                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => toggleOption(opt)}
                    className={cn(
                      'm3-label-md max-w-full overflow-hidden rounded-full px-3 py-1.5 transition-colors',
                      active
                        ? 'bg-primary-container text-on-primary-container shadow-sm'
                        : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                    )}
                    title={opt.label}
                  >
                    <span className="block truncate">
                      {directionHint ? <span className="opacity-70">{directionHint} </span> : null}
                      {opt.label}
                    </span>
                  </button>
                )
              })}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
