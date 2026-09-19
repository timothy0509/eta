'use client'

import * as React from 'react'

import { BottomNav, SideRail, TopAppBar } from '@/components/eta/app-shell'
import { FadeIn, PaneEnter } from '@/components/m3/motion'
import type { SubView, TransportMode, UiLanguage } from '@/lib/eta/types'

type HomeLayoutProps = {
  lang: UiLanguage
  mode: TransportMode
  subView: SubView
  onModeChange: (mode: TransportMode) => void
  onSubViewChange: (subView: SubView) => void
  children: React.ReactNode
}

export function HomeLayout({
  lang,
  mode,
  subView,
  onModeChange,
  onSubViewChange,
  children,
}: HomeLayoutProps) {
  return (
    <div className="bg-surface min-h-dvh overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0">
      <TopAppBar lang={lang} mode={mode} onModeChange={onModeChange} />

      <div className="mx-auto flex max-w-[var(--app-max)] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        <SideRail lang={lang} subView={subView} onSubViewChange={onSubViewChange} />

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px]">{children}</div>
        </div>
      </div>

      <BottomNav lang={lang} subView={subView} onSubViewChange={onSubViewChange} />
    </div>
  )
}

export function StopsLayout({
  controls,
  results,
}: {
  controls: React.ReactNode
  results: React.ReactNode
}) {
  return (
    <PaneEnter className="mx-auto max-w-[var(--app-max)] lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-5.5rem)] lg:[scrollbar-width:thin] lg:overflow-y-auto lg:pr-1">
        <div className="card-m3 p-4 sm:p-5 lg:p-5">{controls}</div>
      </div>

      <FadeIn className="relative mt-4 lg:mt-0" delay={0.05}>
        <div className="bg-surface-container-lowest relative overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 p-4 shadow-sm sm:p-6">
          <span className="bg-primary absolute top-0 right-0 left-0 h-[3px]" aria-hidden />
          {results}
        </div>
      </FadeIn>
    </PaneEnter>
  )
}
