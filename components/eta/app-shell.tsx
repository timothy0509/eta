'use client'

import {
  Bus,
  Globe,
  Heart,
  MapPin,
  Moon,
  Navigation,
  Route,
  Settings,
  Sun,
  TrainFront,
  TramFront,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import * as React from 'react'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
import { isLanguageSupported } from '@/lib/eta/types'
import { useTranslations } from '@/lib/eta/i18n'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

const MODES: Array<{
  mode: TransportMode
  labels: Record<UiLanguage, string>
  icon: React.ComponentType<{ className?: string }>
}> = [
  {
    mode: 'kmb',
    labels: { en: 'Bus', tc: '巴士', sc: '巴士' },
    icon: Bus,
  },
  {
    mode: 'mtr',
    labels: { en: 'MTR', tc: '港鐵', sc: '港铁' },
    icon: TrainFront,
  },
  {
    mode: 'lrt',
    labels: { en: 'Light Rail', tc: '輕鐵', sc: '轻铁' },
    icon: TramFront,
  },
]

const MODE_SHORT_LABELS: Record<TransportMode, string> = {
  kmb: 'KMB',
  mtr: 'MTR',
  lrt: 'LRT',
}

const SUB_VIEWS: Array<{
  id: SubView
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'routes', icon: Route },
  { id: 'stops', icon: MapPin },
  { id: 'nearby', icon: Navigation },
  { id: 'saved', icon: Heart },
  { id: 'settings', icon: Settings },
]

const LANG_LABELS: Record<UiLanguage, string> = {
  en: 'EN',
  tc: '繁',
  sc: '简',
}

function ThemeToggle({ label }: { label: string }) {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

function LanguageMenu({ lang, mode }: { lang: UiLanguage; mode: TransportMode }) {
  const setLang = useAppStore((s) => s.setLang)
  const scSupported = isLanguageSupported(mode, 'sc')
  const label = lang === 'en' ? 'Language' : lang === 'sc' ? '语言' : '語言'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <Globe className="h-5 w-5" />
          <span className="m3-label-md hidden font-semibold xl:inline">{LANG_LABELS[lang]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(LANG_LABELS) as UiLanguage[]).map((l) => (
          <DropdownMenuCheckboxItem
            key={l}
            checked={lang === l}
            disabled={l === 'sc' && !scSupported}
            onCheckedChange={(checked) => {
              if (checked === true) setLang(l)
            }}
          >
            {l === 'en' ? 'English' : l === 'tc' ? '繁體中文' : '简体中文'}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type TopAppBarProps = {
  lang: UiLanguage
  mode: TransportMode
  onModeChange: (mode: TransportMode) => void
}

export function TopAppBar({ lang, mode, onModeChange }: TopAppBarProps) {
  const { t } = useTranslations(lang)

  return (
    <header className="bg-surface-container-low/90 supports-[backdrop-filter]:bg-surface-container-low/80 sticky top-0 z-40 border-b border-[var(--outline-variant)]/15 backdrop-blur">
      <div className="mx-auto flex h-[3.5rem] max-w-[1280px] items-center justify-between gap-2 px-4 sm:h-14 sm:gap-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <div className="bg-primary text-on-primary flex h-8 w-8 items-center justify-center rounded-xl text-[15px] font-bold shadow-sm sm:h-9 sm:w-9 sm:text-lg">
            T
          </div>
          <span className="text-[15px] font-semibold tracking-tight sm:text-[17px]">TimoETA</span>
        </div>

        <nav
          className="flex min-w-0 flex-1 justify-center px-1 sm:px-6"
          aria-label={t('common.routes')}
        >
          <div
            role="group"
            aria-label="Transport mode"
            className="bg-surface-container-high/70 relative flex w-full max-w-[420px] items-center rounded-full p-1 ring-1 ring-[var(--outline-variant)]/20"
          >
            {MODES.map((m) => {
              const Icon = m.icon
              const active = mode === m.mode
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => onModeChange(m.mode)}
                  aria-pressed={active}
                  aria-label={m.labels[lang]}
                  title={m.labels[lang]}
                  className={cn(
                    'relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-2 text-[13px] font-medium transition-colors sm:py-2 sm:text-sm',
                    active
                      ? 'text-on-secondary-container'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
                  {active && (
                    <motion.div
                      layoutId="top-mode-pill"
                      className="bg-secondary-container absolute inset-0 -z-10 rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" />
                  <span className="hidden truncate sm:inline">{m.labels[lang]}</span>
                  <span className="truncate sm:hidden">{MODE_SHORT_LABELS[m.mode]}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="flex shrink-0 items-center">
          <LanguageMenu lang={lang} mode={mode} />
          <ThemeToggle label={t('common.toggleTheme')} />
        </div>
      </div>
    </header>
  )
}

type SideRailProps = {
  lang: UiLanguage
  subView: SubView
  onSubViewChange: (subView: SubView) => void
}

export function SideRail({ lang, subView, onSubViewChange }: SideRailProps) {
  const { t } = useTranslations(lang)

  return (
    <nav
      aria-label="Sections"
      className="bg-surface-container-low border-outline-variant/20 sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-1 rounded-[28px] border px-2 py-3 shadow-sm lg:flex"
    >
      {SUB_VIEWS.map((sv) => {
        const Icon = sv.icon
        const active = subView === sv.id
        return (
          <button
            key={sv.id}
            type="button"
            onClick={() => onSubViewChange(sv.id)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative flex min-h-[44px] w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-colors',
              active ? 'text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {active && (
              <motion.div
                layoutId="side-rail-pill"
                className="bg-primary-container absolute inset-0 -z-10 rounded-2xl"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon className="h-5 w-5" />
            <span className="leading-none">{t(`common.${sv.id}`)}</span>
          </button>
        )
      })}
    </nav>
  )
}

type BottomNavProps = {
  lang: UiLanguage
  subView: SubView
  onSubViewChange: (subView: SubView) => void
}

export function BottomNav({ lang, subView, onSubViewChange }: BottomNavProps) {
  const { t } = useTranslations(lang)

  return (
    <nav
      aria-label="Sections"
      className="bg-surface-container-low fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-full border border-[var(--outline-variant)]/20 px-2 py-1.5 shadow-lg lg:hidden"
    >
      <div className="flex w-full items-center">
        {SUB_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-2 text-[11px] font-medium transition-colors',
                active
                  ? 'text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="bg-primary-container absolute inset-0 -z-10 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="h-[22px] w-[22px]" />
              <span className="leading-none">{t(`common.${sv.id}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
