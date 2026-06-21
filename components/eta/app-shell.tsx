'use client'

import {
  Bus,
  ChevronLeft,
  Heart,
  MapPin,
  Moon,
  Route,
  Settings,
  Sun,
  TrainFront,
  TramFront,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import * as React from 'react'

import { LanguageToggle } from '@/components/eta/language-toggle'
import { Button } from '@/components/ui/button'
import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'
import { useTranslations } from '@/lib/eta/i18n'
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

const SUB_VIEWS: Array<{
  id: SubView
  icon: React.ComponentType<{ className?: string }>
}> = [
  { id: 'routes', icon: Route },
  { id: 'stops', icon: MapPin },
  { id: 'nearby', icon: ChevronLeft },
  { id: 'saved', icon: Heart },
  { id: 'settings', icon: Settings },
]

const NearbyIcon = React.memo(function NearbyIcon({ className }: { className?: string }) {
  return (
    <span className={cn('relative flex h-4 w-4 items-center justify-center', className)}>
      <MapPin className="h-3.5 w-3.5" />
      <span className="bg-primary absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full" />
    </span>
  )
})

// Replace placeholder with a real nearby icon composition
SUB_VIEWS[2] = { id: 'nearby', icon: NearbyIcon }

type TopAppBarProps = {
  lang: UiLanguage
  mode: TransportMode
  onModeChange: (mode: TransportMode) => void
  onLangChange: (lang: UiLanguage) => void
}

export function TopAppBar({ lang, mode, onModeChange, onLangChange }: TopAppBarProps) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const themeMounted = resolvedTheme !== undefined
  const { t } = useTranslations(lang)

  return (
    <header className="bg-surface-container-low/80 sticky top-0 z-40 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary text-on-primary flex h-9 w-9 items-center justify-center rounded-xl text-lg font-bold">
            T
          </div>
          <span className="m3-title-lg hidden font-semibold sm:inline">TimoETA</span>
        </div>

        <nav className="flex-1 px-2 sm:px-6">
          <div className="bg-surface-container relative flex max-w-md items-center rounded-full p-1 shadow-sm">
            {MODES.map((m) => {
              const Icon = m.icon
              const active = mode === m.mode
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => onModeChange(m.mode)}
                  className={cn(
                    'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-medium transition-colors',
                    active
                      ? 'text-on-primary-container'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="top-mode-pill"
                      className="bg-primary-container absolute inset-0 -z-10 rounded-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{m.labels[lang]}</span>
                  <span className="sm:hidden">{m.mode.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="flex items-center gap-2">
          <LanguageToggle mode={mode} value={lang} onChange={onLangChange} />
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={t('common.toggleTheme')}
            onClick={() => {
              const actual = resolvedTheme ?? theme
              setTheme(actual === 'dark' ? 'light' : 'dark')
            }}
          >
            {themeMounted ? (
              (resolvedTheme ?? theme) === 'dark' ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )
            ) : (
              <span className="inline-block h-5 w-5" aria-hidden />
            )}
          </Button>
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
    <nav className="bg-surface-container-low hidden w-20 flex-col items-center gap-2 rounded-r-3xl py-4 shadow-sm md:flex">
      {SUB_VIEWS.map((sv) => {
        const Icon = sv.icon
        const active = subView === sv.id
        return (
          <button
            key={sv.id}
            type="button"
            onClick={() => onSubViewChange(sv.id)}
            className={cn(
              'relative flex w-14 flex-col items-center gap-1 rounded-2xl py-3 text-xs font-medium transition-colors',
              active
                ? 'text-on-secondary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            {active && (
              <motion.div
                layoutId="side-rail-pill"
                className="bg-secondary-container absolute inset-0 -z-10 rounded-2xl"
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              />
            )}
            <Icon className="h-5 w-5" />
            <span>{t(`common.${sv.id}`)}</span>
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
    <nav className="bg-surface-container-low pb-safe fixed right-0 bottom-0 left-0 z-50 rounded-t-3xl px-2 pt-2 shadow-[0_-2px_12px_rgba(0,0,0,0.06)] md:hidden">
      <div className="mx-auto flex max-w-md items-center justify-around">
        {SUB_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              className={cn(
                'relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-2 text-[11px] font-medium transition-colors',
                active
                  ? 'text-on-secondary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              {active && (
                <motion.div
                  layoutId="bottom-nav-pill"
                  className="bg-secondary-container absolute inset-x-1 inset-y-0 -z-10 rounded-2xl"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5" />
              <span>{t(`common.${sv.id}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
