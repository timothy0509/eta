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
import { motion, useReducedMotion } from 'framer-motion'
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

const JOURNEY_VIEWS: Array<{
  id: Exclude<SubView, 'settings'>
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'routes', icon: Route },
  { id: 'stops', icon: MapPin },
  { id: 'nearby', icon: Navigation },
  { id: 'saved', icon: Heart },
]

const LANG_LABELS: Record<UiLanguage, string> = {
  en: 'EN',
  tc: '繁',
  sc: '简',
}

function ThemeToggle({ label, band }: { label: string; band?: boolean }) {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? 'light' : 'dark')}
      aria-label={label}
      title={label}
      className={
        band
          ? 'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'
          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none'
      }
    >
      {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  )
}

function LanguageMenu({
  lang,
  mode,
  band,
}: {
  lang: UiLanguage
  mode: TransportMode
  band?: boolean
}) {
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
          className={
            band
              ? 'flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none'
              : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-full px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none'
          }
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

function useMinuteClock(): string {
  const [now, setNow] = React.useState(() => new Date())
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  return React.useMemo(
    () =>
      new Intl.DateTimeFormat('en-HK', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now),
    [now]
  )
}

function TransitClock() {
  const time = useMinuteClock()
  return (
    <div
      role="timer"
      aria-label={time}
      className="hidden items-center gap-2 text-white tabular-nums sm:flex"
    >
      <span className="relative inline-flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-white opacity-60 motion-safe:animate-ping motion-reduce:hidden" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      <span className="text-[13px] font-semibold tracking-wide">{time}</span>
    </div>
  )
}

type ModeTabsProps = {
  lang: UiLanguage
  mode: TransportMode
  onModeChange: (mode: TransportMode) => void
}

function ModeTabs({ lang, mode, onModeChange }: ModeTabsProps) {
  const reduceMotion = useReducedMotion()
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([])
  const activeIndex = MODES.findIndex((m) => m.mode === mode)

  const activateAt = React.useCallback(
    (index: number) => {
      const next = MODES[(index + MODES.length) % MODES.length]
      if (!next) return
      tabRefs.current[index]?.focus()
      if (next.mode !== mode) onModeChange(next.mode)
    },
    [mode, onModeChange]
  )

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      activateAt(activeIndex + 1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      activateAt(activeIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      activateAt(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      activateAt(MODES.length - 1)
    }
  }

  return (
    <div className="border-trackline bg-backdrop border-t">
      <nav aria-label="Transport mode" className="mx-auto max-w-[1280px] px-4 py-2 sm:px-6">
        <div
          role="tablist"
          aria-label="Transport mode"
          onKeyDown={onKeyDown}
          className="border-trackline bg-platform relative mx-auto flex w-full max-w-xl items-center gap-1 rounded-2xl border p-1.5 shadow-sm"
        >
          {MODES.map((m, index) => {
            const Icon = m.icon
            const active = mode === m.mode
            return (
              <button
                key={m.mode}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                type="button"
                role="tab"
                aria-selected={active}
                aria-label={m.labels[lang]}
                title={m.labels[lang]}
                tabIndex={active ? 0 : -1}
                onClick={() => onModeChange(m.mode)}
                className={cn(
                  'focus-visible:ring-dispatch relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold transition-colors focus-visible:ring-2 focus-visible:outline-none sm:text-sm',
                  active ? 'text-white' : 'text-ink-soft hover:text-ink'
                )}
              >
                {active && (
                  <motion.span
                    layoutId="transit-mode-pill"
                    aria-hidden
                    className={cn(
                      'absolute inset-0 -z-10 rounded-xl shadow-sm',
                      m.mode === 'mtr'
                        ? 'bg-band-mtr'
                        : m.mode === 'lrt'
                          ? 'bg-band-lrt'
                          : 'bg-band-kmb'
                    )}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : { type: 'spring', stiffness: 380, damping: 32 }
                    }
                  />
                )}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{m.labels[lang]}</span>
                <span className="truncate sm:hidden">{MODE_SHORT_LABELS[m.mode]}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

type SectionTabsProps = {
  lang: UiLanguage
  subView: SubView
  onSubViewChange: (subView: SubView) => void
}

export function SectionTabs({ lang, subView, onSubViewChange }: SectionTabsProps) {
  const { t } = useTranslations(lang)
  return (
    <nav aria-label="Sections" className="mx-auto max-w-[1280px] px-4 sm:px-6">
      <div className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 py-2">
        {JOURNEY_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-dispatch flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none',
                active ? 'bg-ink text-platform shadow-sm' : 'text-ink-soft hover:text-ink'
              )}
            >
              <Icon className="h-4 w-4" />
              {t(`common.${sv.id}`)}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

type TopAppBarProps = {
  lang: UiLanguage
  mode: TransportMode
  onModeChange: (mode: TransportMode) => void
  subView: SubView
  onSubViewChange: (subView: SubView) => void
}

export function TopAppBar({ lang, mode, onModeChange, subView, onSubViewChange }: TopAppBarProps) {
  const { t } = useTranslations(lang)
  const settingsActive = subView === 'settings'

  return (
    <header className="sticky top-0 z-40 shadow-md">
      <div
        className={cn(
          'text-white',
          mode === 'mtr' ? 'bg-band-mtr' : mode === 'lrt' ? 'bg-band-lrt' : 'bg-band-kmb'
        )}
      >
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between gap-2 px-4 sm:px-6">
          <div className="flex min-w-0 shrink-0 items-center gap-2.5">
            <div className="text-ink flex h-9 w-9 items-center justify-center rounded-xl bg-white font-sans text-[17px] font-extrabold shadow-sm">
              T
            </div>
            <div className="leading-none">
              <p className="text-[16px] font-bold tracking-tight text-white">TimoETA</p>
              <p className="mt-1 hidden text-[10px] font-semibold tracking-[0.22em] text-white/70 sm:block">
                HK TRANSIT
              </p>
            </div>
          </div>

          <TransitClock />

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={() => onSubViewChange('settings')}
              aria-label={t('common.settings')}
              aria-current={settingsActive ? 'page' : undefined}
              title={t('common.settings')}
              className={cn(
                'flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-white transition-colors hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none',
                settingsActive && 'bg-white/25'
              )}
            >
              <Settings className="h-5 w-5" />
            </button>
            <LanguageMenu lang={lang} mode={mode} band />
            <ThemeToggle label={t('common.toggleTheme')} band />
          </div>
        </div>
      </div>

      <div className="border-trackline bg-backdrop border-b">
        <SectionTabs lang={lang} subView={subView} onSubViewChange={onSubViewChange} />
      </div>
      <ModeTabs lang={lang} mode={mode} onModeChange={onModeChange} />
    </header>
  )
}
