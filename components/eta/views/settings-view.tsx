'use client'

import {
  Bookmark,
  Bus,
  CalendarDays,
  ChevronDown,
  Database,
  Download,
  Globe,
  Info,
  MapPin,
  Monitor,
  Moon,
  Palette,
  RotateCcw,
  Sun,
  Timer,
  Trash2,
  Upload,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { FadeIn } from '@/components/m3/motion'
import { LANG_LABELS, useTranslations } from '@/lib/eta/i18n'
import { idbClear } from '@/lib/eta/cache/idb'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import {
  NEARBY_RADIUS_MAX_KM,
  NEARBY_RADIUS_MIN_KM,
  NEARBY_RADIUS_STEP_KM,
} from '@/lib/eta/nearby-radius'
import { TIMETABLE_DETAIL_MAX, TIMETABLE_DETAIL_MIN } from '@/lib/eta/timetable-detail'
import { isLanguageSupported } from '@/lib/eta/types'
import type { UiLanguage } from '@/lib/eta/types'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

type Props = {
  lang: UiLanguage
}

const REFRESH_OPTIONS = [0, 10, 15, 30, 60]

// Matches the Tailwind lg breakpoint; the sidebar tabs render above it and the
// accordion below it. The view mounts client-side only (next/dynamic ssr:false)
// so the default (false, i.e. mobile) only ever applies on the server.
const DESKTOP_MEDIA = '(min-width: 1024px)'

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, labelKey: 'common.themeLight', descKey: 'settings.themeLightDesc' },
  { value: 'dark', icon: Moon, labelKey: 'common.themeDark', descKey: 'settings.themeDarkDesc' },
  {
    value: 'system',
    icon: Monitor,
    labelKey: 'common.themeSystem',
    descKey: 'settings.themeSystemDesc',
  },
] as const

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  desc?: string
  children: React.ReactNode
}) {
  return (
    <section className="card-m3 p-5">
      <h2 className="m3-title-md flex items-center gap-2">
        <Icon className="h-5 w-5" />
        {title}
      </h2>
      {desc && <p className="text-on-surface-variant m3-label-md mt-1">{desc}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Notice({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="status" className="text-on-surface-variant m3-label-md mt-3">
      {message}
    </p>
  )
}

function ConfirmAction({
  label,
  confirmLabel,
  onConfirm,
  disabled,
}: {
  label: string
  confirmLabel: string
  onConfirm: () => void
  disabled?: boolean
}) {
  const [armed, setArmed] = React.useState(false)
  React.useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), 3000)
    return () => clearTimeout(timer)
  }, [armed])
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false)
          onConfirm()
        } else {
          setArmed(true)
        }
      }}
      className={cn(
        'm3-label-lg inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 transition-colors',
        armed
          ? 'border-transparent bg-[var(--error)] text-[var(--on-error)]'
          : 'text-error border-[var(--error)]/30 hover:bg-[var(--error)]/10',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      <Trash2 className="h-4 w-4" />
      {armed ? confirmLabel : label}
    </button>
  )
}

type Category = {
  id: string
  icon: React.ComponentType<{ className?: string }>
  label: string
  desc?: string
  render: () => React.ReactNode
}

export function SettingsView({ lang }: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const { theme, setTheme } = useTheme()
  const activeTheme = theme ?? 'system'
  const isDesktop = useMediaQuery(DESKTOP_MEDIA)

  const mode = useAppStore((s) => s.mode)
  const storeLang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds)
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds)
  const nearbyRadiusKm = useAppStore((s) => s.nearbyRadiusKm)
  const setNearbyRadiusKm = useAppStore((s) => s.setNearbyRadiusKm)
  const timetableDetail = useAppStore((s) => s.timetableDetail)
  const setTimetableDetail = useAppStore((s) => s.setTimetableDetail)
  const jointRouteInfoOperator = useAppStore((s) => s.jointRouteInfoOperator)
  const setJointRouteInfoOperator = useAppStore((s) => s.setJointRouteInfoOperator)
  const resetPrefs = useAppStore((s) => s.resetPrefs)
  const favorites = useAppStore((s) => s.favorites)
  const recents = useAppStore((s) => s.recents)
  const clearRecents = useAppStore((s) => s.clearRecents)
  const clearFavorites = useAppStore((s) => s.clearFavorites)
  const replaceFavorites = useAppStore((s) => s.replaceFavorites)

  const [dataNotice, setDataNotice] = React.useState<string | null>(null)
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

  // '' means "everything collapsed"; only the mobile accordion can reach it.
  const [activeId, setActiveId] = React.useState('settings-appearance')
  const tabRefs = React.useRef(new Map<string, HTMLButtonElement>())

  const scSupported = isLanguageSupported(mode, 'sc')

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(favorites, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'timoeta-favorites.json'
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(url)
  }

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed: unknown = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) {
        setDataNotice(t('settings.importFailed'))
        return
      }
      replaceFavorites(parsed)
      const kept = useAppStore.getState().favorites.length
      const skipped = parsed.length - kept
      setDataNotice(
        skipped > 0
          ? tWithParams('settings.importedPartial', {
              kept,
              total: parsed.length,
              skipped,
            })
          : tWithParams('settings.imported', { count: kept })
      )
    } catch {
      setDataNotice(t('settings.importFailed'))
    }
  }

  const handleClearCache = async () => {
    try {
      await idbClear()
      setStorageNotice(t('settings.cacheCleared'))
    } catch {
      setStorageNotice(t('settings.actionFailed'))
    }
  }

  const handleReset = () => {
    resetPrefs()
    setTheme('system')
    setStorageNotice(t('settings.settingsReset'))
  }

  // Shared panel bodies. The desktop tabpanel and the mobile accordion both
  // render from this list so the two layouts can never drift apart.
  const categories: Category[] = [
    {
      id: 'settings-appearance',
      icon: Palette,
      label: t('common.appearance'),
      render: () => (
        <div className="flex flex-col gap-2">
          {THEME_OPTIONS.map(({ value, icon: Icon, labelKey, descKey }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={activeTheme === value}
              className={cn(
                'flex min-h-[44px] items-center gap-3 rounded-2xl px-4 py-2 text-left transition-colors',
                activeTheme === value
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>
                <span className="m3-label-lg block">{t(labelKey)}</span>
                <span className="m3-label-md block opacity-70">{t(descKey)}</span>
              </span>
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'settings-language',
      icon: Globe,
      label: t('common.language'),
      desc: t('settings.languageNote'),
      render: () => (
        <div className="flex flex-wrap gap-2">
          {(['en', 'tc', 'sc'] as const).map((l) => {
            const disabled = l === 'sc' && !scSupported
            return (
              <button
                key={l}
                type="button"
                disabled={disabled}
                onClick={() => setLang(l)}
                aria-pressed={storeLang === l}
                className={cn(
                  'm3-label-lg flex min-h-[44px] items-center justify-center rounded-full px-5 py-2 shadow-sm transition-colors',
                  storeLang === l
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  disabled && 'cursor-not-allowed opacity-40'
                )}
                title={disabled ? t('common.scNotSupported') : undefined}
              >
                {LANG_LABELS[l]}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      id: 'settings-refresh',
      icon: Timer,
      label: t('common.autoRefresh'),
      desc: t('settings.refreshDesc'),
      render: () => (
        <div className="flex flex-wrap gap-2">
          {REFRESH_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAutoRefreshSeconds(s)}
              aria-pressed={autoRefreshSeconds === s}
              className={cn(
                'm3-label-lg min-h-[44px] rounded-full px-5 py-2 shadow-sm transition-colors',
                autoRefreshSeconds === s
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              {s === 0 ? t('common.off') : `${s}s`}
            </button>
          ))}
        </div>
      ),
    },
    {
      id: 'settings-route-info',
      icon: Bus,
      label: t('settings.routeInfoTitle'),
      desc: t('settings.routeInfoDesc'),
      render: () => (
        <div className="flex flex-wrap gap-2">
          {(['kmb', 'ctb'] as const).map((operator) => {
            const active = jointRouteInfoOperator === operator
            return (
              <button
                key={operator}
                type="button"
                onClick={() => setJointRouteInfoOperator(operator)}
                aria-pressed={active}
                className={cn(
                  'm3-label-lg flex min-h-[44px] items-center gap-2 rounded-full px-5 py-2 shadow-sm transition-colors',
                  active
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: getOperatorColor(operator) }}
                />
                {operator === 'kmb' ? t('settings.routeInfoKmb') : t('settings.routeInfoCtb')}
              </button>
            )
          })}
        </div>
      ),
    },
    {
      id: 'settings-nearby',
      icon: MapPin,
      label: t('common.nearby'),
      desc: t('settings.nearbyDesc'),
      render: () => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="settings-radius" className="m3-label-lg whitespace-nowrap">
              {t('common.searchRadius')}
            </label>
            <span className="bg-surface-container-high m3-label-lg rounded-full px-3 py-1 tabular-nums">
              {`${Math.round(nearbyRadiusKm * 10) / 10} km`}
            </span>
          </div>
          <input
            id="settings-radius"
            type="range"
            min={NEARBY_RADIUS_MIN_KM}
            max={NEARBY_RADIUS_MAX_KM}
            step={NEARBY_RADIUS_STEP_KM}
            value={nearbyRadiusKm}
            onChange={(event) => setNearbyRadiusKm(Number(event.target.value))}
            className="text-primary ui-press w-full"
            aria-label={t('common.searchRadius')}
          />
        </div>
      ),
    },
    {
      id: 'settings-timetable',
      icon: CalendarDays,
      label: t('settings.timetableTitle'),
      desc: t('settings.timetableDesc'),
      render: () => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-on-surface-variant m3-label-md">
              {t('settings.timetableLeast')}
            </span>
            <span className="bg-surface-container-high m3-label-lg rounded-full px-3 py-1 tabular-nums">
              {tWithParams('settings.timetableLevel', { n: timetableDetail })}
            </span>
            <span className="text-on-surface-variant m3-label-md">
              {t('settings.timetableMost')}
            </span>
          </div>
          <input
            id="settings-timetable-detail"
            type="range"
            min={TIMETABLE_DETAIL_MIN}
            max={TIMETABLE_DETAIL_MAX}
            step={1}
            value={timetableDetail}
            onChange={(event) => setTimetableDetail(Number(event.target.value))}
            className="text-primary ui-press w-full"
            aria-label={t('settings.timetableTitle')}
            aria-valuetext={tWithParams('settings.timetableLevel', { n: timetableDetail })}
          />
        </div>
      ),
    },
    {
      id: 'settings-saved',
      icon: Bookmark,
      label: t('settings.savedData'),
      desc: t('settings.exportImportDesc'),
      render: () => (
        <>
          <div className="flex flex-wrap gap-2">
            <span className="bg-primary-container text-on-primary-container m3-label-lg rounded-full px-3 py-1.5">
              {tWithParams('settings.favoritesCount', { count: favorites.length })}
            </span>
            <span className="bg-surface-container-high text-on-surface-variant m3-label-lg rounded-full px-3 py-1.5">
              {tWithParams('settings.recentsCount', { count: recents.length })}
            </span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={favorites.length === 0}
              className="m3-label-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Download className="h-4 w-4" />
              {t('settings.exportFavorites')}
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="m3-label-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface inline-flex min-h-[44px] items-center gap-2 rounded-full px-4 py-2 transition-colors"
            >
              <Upload className="h-4 w-4" />
              {t('settings.importFavorites')}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={handleImportFile}
              aria-label={t('settings.importFavorites')}
            />
            <ConfirmAction
              label={t('settings.clearHistory')}
              confirmLabel={t('settings.tapAgainToConfirm')}
              disabled={recents.length === 0}
              onConfirm={() => {
                clearRecents()
                setDataNotice(null)
              }}
            />
            <ConfirmAction
              label={t('settings.clearFavorites')}
              confirmLabel={t('settings.tapAgainToConfirm')}
              disabled={favorites.length === 0}
              onConfirm={() => {
                clearFavorites()
                setDataNotice(null)
              }}
            />
          </div>
          <Notice message={dataNotice} />
          <p className="text-on-surface-variant m3-label-md mt-3 flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            {t('favorites.tip')}
          </p>
        </>
      ),
    },
    {
      id: 'settings-storage',
      icon: Database,
      label: t('settings.storage'),
      render: () => (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-on-surface-variant m3-body-md max-w-md">
              {t('settings.clearCacheDesc')}
            </p>
            <button
              type="button"
              onClick={handleClearCache}
              className="m3-label-lg bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full px-4 py-2 transition-colors"
            >
              <Database className="h-4 w-4" />
              {t('settings.clearCache')}
            </button>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-on-surface-variant m3-body-md max-w-md">
              {t('settings.resetSettingsDesc')}
            </p>
            <ConfirmAction
              label={t('settings.resetSettings')}
              confirmLabel={t('settings.tapAgainToConfirm')}
              onConfirm={handleReset}
            />
          </div>
          <Notice message={storageNotice} />
        </div>
      ),
    },
    {
      id: 'settings-about',
      icon: Info,
      label: t('settings.about'),
      render: () => (
        <>
          <dl className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-on-surface-variant m3-body-md">{t('common.transportMode')}</dt>
              <dd className="m3-label-lg">TimoETA</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-on-surface-variant m3-body-md">{t('settings.version')}</dt>
              <dd className="m3-label-lg tabular-nums">{APP_VERSION}</dd>
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-on-surface-variant m3-body-md shrink-0">
                {t('settings.dataSources')}
              </dt>
              <dd className="m3-label-md text-right">
                data.etabus.gov.hk · rt.data.gov.hk · hk-bus-eta
              </dd>
            </div>
          </dl>
          <p className="text-on-surface-variant m3-label-md mt-3">
            {t('settings.dataSourcesNote')}
          </p>
        </>
      ),
    },
  ]

  if (isDesktop) {
    const desktopActiveId = categories.some((c) => c.id === activeId) ? activeId : categories[0].id
    const desktopActive = categories.find((c) => c.id === desktopActiveId)

    const handleTabListKeyDown = (event: React.KeyboardEvent) => {
      const order = categories.map((c) => c.id)
      const current = order.indexOf(desktopActiveId)
      let next = -1
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        next = (current + 1) % order.length
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        next = (current - 1 + order.length) % order.length
      } else if (event.key === 'Home') {
        next = 0
      } else if (event.key === 'End') {
        next = order.length - 1
      } else {
        return
      }
      event.preventDefault()
      const nextId = order[next]
      setActiveId(nextId)
      tabRefs.current.get(nextId)?.focus()
    }

    return (
      <FadeIn className="mx-auto max-w-4xl">
        <header>
          <h1 className="m3-headline-sm">{t('common.settings')}</h1>
          <p className="text-on-surface-variant m3-body-md mt-1">{t('settings.subheading')}</p>
        </header>

        <div className="mt-4 grid grid-cols-[210px_minmax(0,1fr)] items-start gap-4">
          <div
            role="tablist"
            aria-label={t('common.settings')}
            onKeyDown={handleTabListKeyDown}
            className="bg-surface-container-low border-outline-variant/20 sticky top-[4.5rem] flex flex-col gap-1 rounded-2xl border p-1.5 shadow-sm"
          >
            {categories.map(({ id, icon: Icon, label }) => {
              const active = desktopActiveId === id
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  id={`${id}-tab`}
                  aria-selected={active}
                  aria-controls="settings-panel"
                  tabIndex={active ? 0 : -1}
                  ref={(el) => {
                    if (el) tabRefs.current.set(id, el)
                    else tabRefs.current.delete(id)
                  }}
                  onClick={() => setActiveId(id)}
                  className={cn(
                    'm3-label-lg ui-press flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
                    active
                      ? 'bg-primary-container text-on-primary-container'
                      : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {label}
                </button>
              )
            })}
          </div>

          <div
            className="min-w-0"
            role="tabpanel"
            id="settings-panel"
            aria-labelledby={`${desktopActiveId}-tab`}
            aria-label={desktopActive?.label ?? ''}
          >
            {desktopActive && (
              <Section
                icon={desktopActive.icon}
                title={desktopActive.label}
                desc={desktopActive.desc}
              >
                {desktopActive.render()}
              </Section>
            )}
          </div>
        </div>
      </FadeIn>
    )
  }

  return (
    <FadeIn className="mx-auto max-w-4xl">
      <header>
        <h1 className="m3-headline-sm">{t('common.settings')}</h1>
        <p className="text-on-surface-variant m3-body-md mt-1">{t('settings.subheading')}</p>
      </header>

      <div className="mx-auto mt-4 flex w-full max-w-2xl flex-col gap-2.5">
        {categories.map((cat) => {
          const Icon = cat.icon
          const expanded = activeId === cat.id
          return (
            <section key={cat.id} className="card-m3 overflow-hidden transition-colors">
              <button
                type="button"
                id={`${cat.id}-btn`}
                aria-expanded={expanded}
                aria-controls={`${cat.id}-panel`}
                onClick={() => setActiveId(expanded ? '' : cat.id)}
                className="ui-press focus-visible:ring-primary/40 flex min-h-[60px] w-full items-center gap-3 px-4 py-3.5 text-left focus-visible:ring-2 focus-visible:outline-none sm:px-5"
              >
                <span className="bg-secondary-container text-on-secondary-container flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
                  <Icon className="h-[18px] w-[18px]" aria-hidden />
                </span>
                <span
                  className={cn(
                    'm3-title-md flex-1 transition-colors',
                    expanded ? 'text-on-surface' : 'text-on-surface-variant'
                  )}
                >
                  {cat.label}
                </span>
                <ChevronDown
                  aria-hidden
                  className={cn(
                    'text-on-surface-variant ui-chevron h-[18px] w-[18px] shrink-0',
                    expanded && 'rotate-180'
                  )}
                />
              </button>
              <div
                id={`${cat.id}-panel`}
                role="region"
                aria-labelledby={`${cat.id}-btn`}
                aria-hidden={!expanded}
                inert={!expanded}
                className={cn(
                  'ui-expand-panel grid motion-reduce:transition-none',
                  expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div
                    className={cn(
                      'ui-expand-inner',
                      expanded ? 'translate-y-0' : '-translate-y-1.5'
                    )}
                  >
                    <div className="px-4 pt-1 pb-5 sm:px-5">
                      {cat.desc && <p className="text-on-surface-variant m3-body-md">{cat.desc}</p>}
                      <div className={cn(cat.desc ? 'mt-4' : 'mt-1')}>{cat.render()}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </FadeIn>
  )
}
