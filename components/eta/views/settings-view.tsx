'use client'

import { Globe, Monitor, Moon, Palette, Sun, Timer } from 'lucide-react'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { FadeIn } from '@/components/m3/motion'
import { useTranslations } from '@/lib/eta/i18n'
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

export function SettingsView({ lang }: Props) {
  const { t } = useTranslations(lang)
  const { theme, setTheme } = useTheme()
  const activeTheme = theme ?? 'system'

  const mode = useAppStore((s) => s.mode)
  const storeLang = useAppStore((s) => s.lang)
  const setLang = useAppStore((s) => s.setLang)
  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds)
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds)

  const scSupported = isLanguageSupported(mode, 'sc')

  return (
    <FadeIn className="mx-auto max-w-3xl space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="bg-surface-container-low rounded-3xl border border-[var(--outline-variant)]/15 p-5 shadow-sm">
          <h2 className="m3-title-md mb-4 flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t('common.appearance')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={cn(
                  'm3-label-lg flex items-center gap-2 rounded-full px-5 py-2 shadow-sm transition-colors',
                  activeTheme === value
                    ? 'bg-primary-container text-on-primary-container'
                    : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
                )}
              >
                <Icon className="h-4 w-4" />
                {t(labelKey)}
              </button>
            ))}
          </div>
        </section>

        <section className="bg-surface-container-low rounded-3xl border border-[var(--outline-variant)]/15 p-5 shadow-sm">
          <h2 className="m3-title-md mb-4 flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t('common.language')}
          </h2>
          <div className="flex flex-wrap gap-2">
            {(['en', 'tc', 'sc'] as const).map((l) => {
              const disabled = l === 'sc' && !scSupported
              return (
                <button
                  key={l}
                  type="button"
                  disabled={disabled}
                  onClick={() => setLang(l)}
                  className={cn(
                    'm3-label-lg rounded-full px-5 py-2 shadow-sm transition-colors',
                    storeLang === l
                      ? 'bg-primary-container text-on-primary-container'
                      : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                    disabled && 'cursor-not-allowed opacity-40'
                  )}
                  title={
                    disabled
                      ? lang === 'en'
                        ? 'Simplified Chinese is not supported for this mode'
                        : lang === 'sc'
                          ? '此模式不支持简体中文'
                          : '此模式不支援簡體中文'
                      : undefined
                  }
                >
                  {l === 'en' ? 'EN' : l === 'tc' ? '繁' : '简'}
                </button>
              )
            })}
          </div>
        </section>
      </div>

      <section className="bg-surface-container-low rounded-3xl border border-[var(--outline-variant)]/15 p-5 shadow-sm">
        <h2 className="m3-title-md mb-4 flex items-center gap-2">
          <Timer className="h-5 w-5" />
          {t('common.autoRefresh')}
        </h2>
        <div className="flex flex-wrap gap-2">
          {REFRESH_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAutoRefreshSeconds(s)}
              className={cn(
                'm3-label-lg rounded-full px-5 py-2 shadow-sm transition-colors',
                autoRefreshSeconds === s
                  ? 'bg-primary-container text-on-primary-container'
                  : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
              )}
            >
              {s === 0 ? t('common.off') : `${s}s`}
            </button>
          ))}
        </div>
      </section>
    </FadeIn>
  )
}
