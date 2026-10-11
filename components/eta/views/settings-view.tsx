'use client'

import { Globe, Monitor, Moon, Palette, SlidersHorizontal, Sun, Timer } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { FadeIn } from '@/components/m3/motion'
import { LANG_LABELS, useTranslations } from '@/lib/eta/i18n'
import { isLanguageSupported } from '@/lib/eta/types'
import type { UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type Props = {
  lang: UiLanguage
}

const REFRESH_OPTIONS = [0, 10, 15, 30, 60]

const THEME_OPTIONS = [
  { value: 'light', icon: Sun, labelKey: 'common.themeLight' },
  { value: 'dark', icon: Moon, labelKey: 'common.themeDark' },
  { value: 'system', icon: Monitor, labelKey: 'common.themeSystem' },
] as const

/** M3-style pill segment used for theme, language, and refresh picks. */
function PillOption({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  title?: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'm3-label-lg flex min-h-[44px] items-center justify-center gap-2 rounded-full px-5 shadow-sm transition-colors',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        disabled && 'cursor-not-allowed opacity-40'
      )}
    >
      {children}
    </button>
  )
}

/** M3-style switch. Track fills with primary when on, knob slides right. */
function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative h-8 w-[52px] shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-primary' : 'border-outline bg-surface-container-highest border-2 border-solid'
      )}
    >
      <span
        className={cn(
          'absolute top-1/2 left-1/2 -translate-y-1/2 rounded-full transition-all duration-200',
          checked
            ? 'bg-on-primary left-6 h-6 w-6'
            : 'bg-outline group-hover:bg-on-surface left-4 h-4 w-4'
        )}
      />
    </button>
  )
}

function SettingHeader({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="text-primary flex items-center gap-2 px-4 pt-5 sm:px-6">
      <Icon className="h-5 w-5" />
      <h2 className="m3-title-md">{title}</h2>
    </div>
  )
}

function ToggleRow({
  title,
  description,
  label,
  checked,
  onCheckedChange,
}: {
  title: string
  description?: string
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 sm:px-6">
      <div className="min-w-0 flex-1">
        <div className="text-on-surface m3-body-lg font-medium">{title}</div>
        {description ? (
          <div className="text-on-surface-variant m3-label-md mt-0.5">{description}</div>
        ) : null}
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} label={label} />
    </div>
  )
}

export function SettingsView({ lang }: Props) {
  const { t } = useTranslations(lang)
  const { theme, setTheme } = useTheme()
  const activeTheme = theme ?? 'system'

  const mode = useAppStore((s) => s.mode)
  const storeLang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds)
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds)
  const showStopCodeFare = useAppStore((s) => s.showStopCodeFare)
  const setShowStopCodeFare = useAppStore((s) => s.setShowStopCodeFare)
  const exactEtaTime = useAppStore((s) => s.exactEtaTime)
  const setExactEtaTime = useAppStore((s) => s.setExactEtaTime)

  const scSupported = isLanguageSupported(mode, 'sc')

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-4 pb-8">
      <section className="card-m3 pb-4">
        <SettingHeader icon={Palette} title={t('common.appearance')} />
        <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6">
          {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
            <PillOption key={value} active={activeTheme === value} onClick={() => setTheme(value)}>
              <Icon className="h-4 w-4" />
              {t(labelKey)}
            </PillOption>
          ))}
        </div>
      </section>

      <section className="card-m3 pb-4">
        <SettingHeader icon={Globe} title={t('common.language')} />
        <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6">
          {(['en', 'tc', 'sc'] as const).map((l) => {
            const disabled = l === 'sc' && !scSupported
            return (
              <PillOption
                key={l}
                active={storeLang === l}
                disabled={disabled}
                onClick={() => setLang(l)}
                title={disabled ? t('common.scNotSupported') : undefined}
              >
                {LANG_LABELS[l]}
              </PillOption>
            )
          })}
        </div>
      </section>

      <section className="card-m3 pb-3">
        <SettingHeader icon={SlidersHorizontal} title={t('common.display')} />
        <div className="divide-outline-variant/30 mt-2 divide-y">
          <ToggleRow
            title={t('common.showStopCodeFare')}
            description={t('common.showStopCodeFareDesc')}
            label={t('common.showStopCodeFare')}
            checked={showStopCodeFare}
            onCheckedChange={setShowStopCodeFare}
          />
          <ToggleRow
            title={t('common.exactEtaTime')}
            description={t('common.exactEtaTimeDesc')}
            label={t('common.exactEtaTime')}
            checked={exactEtaTime}
            onCheckedChange={setExactEtaTime}
          />
        </div>
      </section>

      <section className="card-m3 pb-4">
        <SettingHeader icon={Timer} title={t('common.autoRefresh')} />
        <div className="flex flex-wrap gap-2 px-4 pt-4 sm:px-6">
          {REFRESH_OPTIONS.map((s) => (
            <PillOption
              key={s}
              active={autoRefreshSeconds === s}
              onClick={() => setAutoRefreshSeconds(s)}
            >
              {s === 0 ? t('common.off') : `${s}s`}
            </PillOption>
          ))}
        </div>
      </section>
    </FadeIn>
  )
}
