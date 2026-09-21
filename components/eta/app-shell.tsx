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
import { LANG_LABELS, useTranslations } from '@/lib/eta/i18n'
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

// Preload the Leaflet map chunk on hover/focus of the nearby tab so the
// chunk arrives before the tap, without paying for it on startup.
let mapPreloadStarted = false
function preloadTransitMap(): void {
  if (mapPreloadStarted) return
  mapPreloadStarted = true
  import('@/components/eta/transit-map').catch(() => {
    mapPreloadStarted = false
  })
}
// Sliding pill shared by the transport switcher and the section navs.
// Measures the active button relative to its container and moves a single
// absolute indicator with a spring transition.
function useSlidingIndicator<T extends HTMLElement>(activeId: string, extraKey: string) {
  const containerRef = React.useRef<T | null>(null)
  const buttonRefs = React.useRef(new Map<string, HTMLButtonElement>())
  const [indicator, setIndicator] = React.useState({ x: 0, y: 0, w: 0, h: 0, ready: false })

  const measure = React.useCallback(() => {
    const container = containerRef.current
    const activeButton = buttonRefs.current.get(activeId)
    if (!container || !activeButton) return
    const containerRect = container.getBoundingClientRect()
    const rect = activeButton.getBoundingClientRect()
    // Hidden navs (SideRail on mobile, BottomNav on desktop) measure at
    // zero size. Stay unready until visible so the pill never flashes at 0.
    if (rect.width === 0 && rect.height === 0) return
    setIndicator({
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      w: rect.width,
      h: rect.height,
      ready: true,
    })
  }, [activeId])

  React.useLayoutEffect(() => {
    measure()
  }, [measure, extraKey])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measure())
    observer.observe(container)
    for (const button of buttonRefs.current.values()) observer.observe(button)
    return () => observer.disconnect()
  }, [measure])

  return { containerRef, buttonRefs, indicator }
}
function ThemeToggle({ label }: { label: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
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
  const { t } = useTranslations(lang)
  const label = t('common.language')
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
  const { containerRef, buttonRefs, indicator } = useSlidingIndicator<HTMLDivElement>(mode, lang)

  return (
    <header className="bg-surface-container-low/90 supports-[backdrop-filter]:bg-surface-container-low/80 sticky top-0 z-40 border-b border-[var(--outline-variant)]/15 backdrop-blur">
      <div className="mx-auto flex h-[3.5rem] max-w-[var(--app-max)] items-center justify-between gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6">
        <div className="flex shrink-0 items-center gap-2">
          <div className="bg-primary text-on-primary flex h-8 w-8 items-center justify-center rounded-xl text-[15px] font-bold shadow-sm sm:h-9 sm:w-9 sm:text-lg">
            T
          </div>
          <span className="hidden text-[15px] font-semibold tracking-tight min-[500px]:inline sm:text-[17px]">
            TimoETA
          </span>
        </div>

        <nav className="flex min-w-0 flex-1 justify-center sm:px-6" aria-label={t('common.routes')}>
          <div
            ref={containerRef}
            role="group"
            aria-label={t('common.transportMode')}
            className="bg-surface-container-high/70 relative flex w-full max-w-[420px] items-center rounded-full p-1 ring-1 ring-[var(--outline-variant)]/20"
          >
            <span
              aria-hidden
              className="bg-secondary-container ui-indicator-slide pointer-events-none absolute top-1 bottom-1 left-0 rounded-full shadow-sm"
              style={
                indicator.ready
                  ? { transform: `translateX(${indicator.x}px)`, width: indicator.w }
                  : {
                      left: `${(MODES.findIndex((m) => m.mode === mode) / MODES.length) * 100}%`,
                      width: `${100 / MODES.length}%`,
                    }
              }
            />
            {MODES.map((m) => {
              const Icon = m.icon
              const active = mode === m.mode
              return (
                <button
                  key={m.mode}
                  ref={(el) => {
                    if (el) buttonRefs.current.set(m.mode, el)
                    else buttonRefs.current.delete(m.mode)
                  }}
                  type="button"
                  onClick={() => onModeChange(m.mode)}
                  aria-pressed={active}
                  aria-label={m.labels[lang]}
                  title={m.labels[lang]}
                  className={cn(
                    'relative z-10 flex min-h-[44px] flex-1 items-center justify-center gap-1 rounded-full px-1 text-xs font-medium transition-colors min-[500px]:gap-1.5 min-[500px]:px-2 min-[500px]:text-[13px] sm:py-2 sm:text-sm',
                    active
                      ? 'text-on-secondary-container'
                      : 'text-on-surface-variant hover:text-on-surface'
                  )}
                >
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
  const { containerRef, buttonRefs, indicator } = useSlidingIndicator<HTMLDivElement>(subView, lang)

  return (
    <nav
      aria-label={t('common.sections')}
      className="bg-surface-container-low border-outline-variant/20 sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-1 rounded-[28px] border px-2 py-3 shadow-sm lg:flex"
    >
      <div ref={containerRef} className="relative flex flex-col items-center gap-1">
        {indicator.ready && (
          <span
            aria-hidden
            className="bg-primary-container ui-indicator-slide pointer-events-none absolute top-0 left-0 rounded-2xl"
            style={{
              transform: `translate(${indicator.x}px, ${indicator.y}px)`,
              width: indicator.w,
              height: indicator.h,
            }}
          />
        )}
        {SUB_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          const preloadProps =
            sv.id === 'nearby'
              ? {
                  onMouseEnter: preloadTransitMap,
                  onFocus: preloadTransitMap,
                  onTouchStart: preloadTransitMap,
                }
              : {}
          return (
            <button
              key={sv.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(sv.id, el)
                else buttonRefs.current.delete(sv.id)
              }}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              aria-current={active ? 'page' : undefined}
              {...preloadProps}
              className={cn(
                'ui-press relative z-10 flex min-h-[44px] w-[64px] flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[11px] font-medium transition-[color,background-color,transform]',
                active
                  ? 'text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Icon className={cn('h-5 w-5 transition-transform', active && 'scale-110')} />
              <span className="leading-none">{t(`common.${sv.id}`)}</span>
            </button>
          )
        })}
      </div>
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
  const { containerRef, buttonRefs, indicator } = useSlidingIndicator<HTMLDivElement>(subView, lang)

  return (
    <nav
      aria-label={t('common.sections')}
      className="bg-surface-container-low fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-full border border-[var(--outline-variant)]/20 px-2 py-1.5 shadow-lg lg:hidden"
    >
      <div ref={containerRef} className="relative flex w-full items-center">
        {indicator.ready && (
          <span
            aria-hidden
            className="bg-primary-container ui-indicator-slide pointer-events-none absolute top-0 left-0 rounded-full"
            style={{
              transform: `translate(${indicator.x}px, ${indicator.y}px)`,
              width: indicator.w,
              height: indicator.h,
            }}
          />
        )}
        {SUB_VIEWS.map((sv) => {
          const Icon = sv.icon
          const active = subView === sv.id
          const preloadProps =
            sv.id === 'nearby'
              ? {
                  onMouseEnter: preloadTransitMap,
                  onFocus: preloadTransitMap,
                  onTouchStart: preloadTransitMap,
                }
              : {}
          return (
            <button
              key={sv.id}
              ref={(el) => {
                if (el) buttonRefs.current.set(sv.id, el)
                else buttonRefs.current.delete(sv.id)
              }}
              type="button"
              onClick={() => onSubViewChange(sv.id)}
              aria-current={active ? 'page' : undefined}
              {...preloadProps}
              className={cn(
                'ui-press relative z-10 flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-full px-1 py-2 text-[11px] font-medium transition-[color,background-color,transform]',
                active
                  ? 'text-on-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface'
              )}
            >
              <Icon
                className={cn('h-[22px] w-[22px] transition-transform', active && 'scale-110')}
              />
              <span className="leading-none">{t(`common.${sv.id}`)}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
