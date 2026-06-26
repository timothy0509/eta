'use client'

import { ChevronLeft, MapPin, TrainFront } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { FadeIn, MotionCard, StaggerContainer, StaggerItem } from '@/components/m3/motion'
import {
  MTR_STATIONS,
  findMtrStationsByLine,
  formatMtrStationName,
  type MtrLang,
} from '@/lib/data/mtr-stations'
import { getLineColor } from '@/lib/eta/line-colors'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { getReadableForeground } from '@/lib/ui/color'
import { cn } from '@/lib/utils'

const LINE_ORDER = ['AEL', 'TCL', 'TML', 'TKL', 'EAL', 'SIL', 'TWL', 'ISL', 'KTL', 'DRL']

function toMtrLang(lang: UiLanguage): MtrLang {
  return lang === 'en' ? 'EN' : 'TC'
}

function sortLines(a: string, b: string): number {
  const ai = LINE_ORDER.indexOf(a)
  const bi = LINE_ORDER.indexOf(b)
  if (ai >= 0 && bi >= 0) return ai - bi
  if (ai >= 0) return -1
  if (bi >= 0) return 1
  return a.localeCompare(b)
}

export function MtrRoutesView({
  lang,
  onViewEtas,
}: {
  lang: UiLanguage
  onViewEtas?: (sta: string) => void
}) {
  const { t } = useTranslations(lang)
  const [selectedLine, setSelectedLine] = React.useState<string | null>(null)

  const lines = React.useMemo(() => {
    const set = new Set<string>()
    for (const station of MTR_STATIONS) {
      for (const line of station.lines) {
        set.add(line)
      }
    }
    return Array.from(set).sort(sortLines)
  }, [])

  const stations = React.useMemo(() => {
    if (!selectedLine) return []
    return findMtrStationsByLine(selectedLine)
  }, [selectedLine])

  return (
    <div className="bg-surface-container-low rounded-3xl p-4 shadow-sm">
      <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
        <TrainFront className="h-5 w-5" />
        {t('mtr.lines')}
      </div>

      {!selectedLine ? (
        <StaggerContainer className="grid grid-cols-2 gap-3 sm:grid-cols-3" stagger={0.03}>
          {lines.map((line) => {
            const color = getLineColor(line)
            const fg = getReadableForeground(color)
            return (
              <StaggerItem key={line}>
                <MotionCard
                  hoverScale={1.02}
                  tapScale={0.98}
                  className={cn('rounded-2xl p-4 shadow-sm transition-shadow hover:shadow-md', fg)}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedLine(line)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') setSelectedLine(line)
                  }}
                >
                  <div className="m3-title-lg">{line}</div>
                  <div className="m3-label-lg opacity-90">{t('common.route')}</div>
                </MotionCard>
              </StaggerItem>
            )
          })}
        </StaggerContainer>
      ) : (
        <FadeIn className="space-y-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedLine(null)}
              className="bg-secondary-container text-on-secondary-container m3-label-lg inline-flex items-center gap-1 rounded-full px-4 py-2 transition-colors hover:opacity-90"
            >
              <ChevronLeft className="h-4 w-4" />
              {t('common.back')}
            </button>
            <span
              className="m3-title-md rounded-full px-4 py-2"
              style={{
                backgroundColor: getLineColor(selectedLine),
                color:
                  getReadableForeground(getLineColor(selectedLine)) === 'text-white'
                    ? '#fff'
                    : '#000',
              }}
            >
              {selectedLine}
            </span>
          </div>

          <div className="bg-surface-container rounded-2xl p-4">
            <div className="m3-title-md text-on-surface mb-3 flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {t('mtr.stations')}
              <span className="text-on-surface-variant m3-body-md ml-auto">{stations.length}</span>
            </div>

            <StaggerContainer className="space-y-2" stagger={0.02}>
              {stations.map((station) => (
                <StaggerItem key={station.sta}>
                  <div className="bg-surface-container-low hover:bg-surface-container-high flex items-center gap-3 rounded-xl px-4 py-3 transition-colors">
                    <div className="bg-surface text-on-surface-variant flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <MapPin className="h-4 w-4" />
                    </div>
                    <div className="m3-body-md text-on-surface min-w-0 flex-1">
                      {formatMtrStationName(station, toMtrLang(lang))}
                    </div>
                    <div className="text-on-surface-variant m3-label-md hidden sm:block">
                      {station.sta}
                    </div>
                    {onViewEtas && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => onViewEtas(station.sta)}
                      >
                        {t('common.viewEtas')}
                      </Button>
                    )}
                  </div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>

          <div className="bg-surface-container rounded-2xl p-4">
            <div className="m3-title-md text-on-surface mb-2">{t('common.map')}</div>
            <div className="text-on-surface-variant m3-body-md bg-surface-container-high flex h-32 items-center justify-center rounded-2xl">
              {t('common.mapUnavailable')}
            </div>
          </div>
        </FadeIn>
      )}
    </div>
  )
}
