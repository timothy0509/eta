'use client'

import {
  Bookmark,
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
import {
  NEARBY_RADIUS_MAX_KM,
  NEARBY_RADIUS_MIN_KM,
  NEARBY_RADIUS_STEP_KM,
} from '@/lib/eta/nearby-radius'
import { isLanguageSupported } from '@/lib/eta/types'
import type { UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { APP_VERSION } from '@/lib/version'

type Props = {
  lang: UiLanguage
}

const REFRESH_OPTIONS = [0, 10, 15, 30, 60]

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

export function SettingsView({ lang }: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const { theme, setTheme } = useTheme()
  const activeTheme = theme ?? 'system'

  const mode = useAppStore((s) => s.mode)
  const storeLang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds)
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds)
  const nearbyRadiusKm = useAppStore((s) => s.nearbyRadiusKm)
  const setNearbyRadiusKm = useAppStore((s) => s.setNearbyRadiusKm)
  const resetPrefs = useAppStore((s) => s.resetPrefs)
  const favorites = useAppStore((s) => s.favorites)
  const recents = useAppStore((s) => s.recents)
  const clearRecents = useAppStore((s) => s.clearRecents)
  const clearFavorites = useAppStore((s) => s.clearFavorites)
  const replaceFavorites = useAppStore((s) => s.replaceFavorites)

  const [dataNotice, setDataNotice] = React.useState<string | null>(null)
  const [storageNotice, setStorageNotice] = React.useState<string | null>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)

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

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-4">
      <header>
        <h1 className="m3-headline-sm">{t('common.settings')}</h1>
        <p className="text-on-surface-variant m3-body-md mt-1">{t('settings.subheading')}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <Section icon={Palette} title={t('common.appearance')}>
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
        </Section>

        <Section icon={Globe} title={t('common.language')} desc={t('settings.languageNote')}>
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
        </Section>
      </div>

      <Section icon={Timer} title={t('common.autoRefresh')} desc={t('settings.refreshDesc')}>
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
      </Section>

      <Section icon={MapPin} title={t('common.nearby')} desc={t('settings.nearbyDesc')}>
        <div className="flex items-center gap-3">
          <label
            className="text-on-surface-variant m3-label-md whitespace-nowrap"
            htmlFor="settings-radius"
          >
            {t('common.searchRadius')}
          </label>
          <input
            id="settings-radius"
            type="range"
            min={NEARBY_RADIUS_MIN_KM}
            max={NEARBY_RADIUS_MAX_KM}
            step={NEARBY_RADIUS_STEP_KM}
            value={nearbyRadiusKm}
            onChange={(event) => setNearbyRadiusKm(Number(event.target.value))}
            className="text-primary ui-press w-full min-w-32"
            aria-label={t('common.searchRadius')}
          />
          <span className="text-on-surface-variant m3-label-md w-14 shrink-0 text-right tabular-nums">
            {`${Math.round(nearbyRadiusKm * 10) / 10} km`}
          </span>
        </div>
      </Section>

      <Section
        icon={Bookmark}
        title={t('settings.savedData')}
        desc={t('settings.exportImportDesc')}
      >
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
      </Section>

      <Section icon={Database} title={t('settings.storage')}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
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
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-on-surface-variant m3-body-md max-w-md">
              {t('settings.resetSettingsDesc')}
            </p>
            <ConfirmAction
              label={t('settings.resetSettings')}
              confirmLabel={t('settings.tapAgainToConfirm')}
              onConfirm={handleReset}
            />
          </div>
        </div>
        <Notice message={storageNotice} />
      </Section>

      <Section icon={Info} title={t('settings.about')}>
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
        <p className="text-on-surface-variant m3-label-md mt-3">{t('settings.dataSourcesNote')}</p>
      </Section>

      <p className="text-on-surface-variant m3-label-md flex items-center gap-1.5 px-1 pb-2">
        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
        {t('favorites.tip')}
      </p>
    </FadeIn>
  )
}
