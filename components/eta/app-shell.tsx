'use client'

import {
  Bus,
  ChevronLeft,
  Heart,
  MapPin,
  Route,
  Settings,
  TrainFront,
  TramFront,
} from 'lucide-react'
import { motion } from 'framer-motion'
import * as React from 'react'

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
}

export function TopAppBar({ lang, mode, onModeChange }: TopAppBarProps) {
  return (
    <header className="bg-surface-container-low/90 supports-[backdrop-filter]:bg-surface-container-low/80 sticky top-0 z-40 border-b border-[var(--outline-variant)]/15 backdrop-blur">
      <div className="mx-auto flex h-[3.5rem] max-w-[1280px] items-center justify-between gap-3 px-4 sm:h-14 sm:px-6">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary text-on-primary flex h-8 w-8 items-center justify-center rounded-xl text-[15px] font-bold shadow-sm sm:h-9 sm:w-9 sm:text-lg">
            T
          </div>
          <span className="hidden text-[17px] font-semibold tracking-tight sm:inline">TimoETA</span>
        </div>

        <nav className="flex flex-1 justify-center px-2 sm:px-6">
          <div className="bg-surface-container-high/70 relative flex w-full max-w-[420px] items-center rounded-full p-1 ring-1 ring-[var(--outline-variant)]/20">
            {MODES.map((m) => {
              const Icon = m.icon
              const active = mode === m.mode
              return (
                <button
                  key={m.mode}
                  type="button"
                  onClick={() => onModeChange(m.mode)}
                  className={cn(
                    'relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-1.5 text-[13px] font-medium transition-colors sm:py-2 sm:text-sm',
                    active
                      ? 'text-on-secondary-container'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="top-mode-pill"
                      className="bg-secondary-container absolute inset-0 -z-10 rounded-full shadow-sm"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                    />
                  )}
                  <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{m.labels[lang]}</span>
                  <span className="sm:hidden">{m.mode.toUpperCase()}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <div className="hidden w-[72px] shrink-0 sm:block" aria-hidden />
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
    <nav className="bg-surface-container-low border-outline-variant/20 sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-1 rounded-[28px] border px-2 py-3 shadow-sm md:flex">
      {SUB_VIEWS.map((sv) => {
        const Icon = sv.icon
        const active = subView === sv.id
        return (
          <button
            key={sv.id}
            type="button"
            onClick={() => onSubViewChange(sv.id)}
            className={cn(
              'relative flex w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-colors',
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
    <nav className="bg-surface-container-low fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-full border border-[var(--outline-variant)]/20 px-2 py-1.5 shadow-lg md:hidden">
      <div className="flex w-full items-center">
        {SUB_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          return (
            <button
              key={sv.id}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              className={cn(
                'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-2 py-2 text-[11px] font-medium transition-colors',
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
              <span>{t(`common.${sv.id}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
