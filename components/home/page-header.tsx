'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'

import { AutoRefreshMenu } from '@/components/eta/auto-refresh'
import { Button } from '@/components/ui/button'
import type { UiLanguage } from '@/lib/eta/types'

type Labels = {
  description: string
  saved: string
  theme: string
  toggleTheme: string
}

type Props = {
  labels: Labels
  lang: UiLanguage
  savedOpen: boolean
  onToggleSaved: () => void
  autoRefreshSeconds: number
  onAutoRefreshChange: (seconds: number) => void
  themeMounted: boolean
  resolvedTheme?: string
  theme?: string
  onToggleTheme: () => void
}

export function PageHeader({
  labels,
  lang,
  savedOpen,
  onToggleSaved,
  autoRefreshSeconds,
  onAutoRefreshChange,
  themeMounted,
  resolvedTheme,
  theme,
  onToggleTheme,
}: Props) {
  return (
    <div className="ui-animate-in flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TimoETA</h1>
        <p className="text-muted-foreground mt-1 text-sm">{labels.description}</p>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={onToggleSaved}
          aria-expanded={savedOpen}
          aria-controls="saved-panel"
        >
          {labels.saved}
        </Button>
        <AutoRefreshMenu
          lang={lang}
          valueSeconds={autoRefreshSeconds}
          onChange={onAutoRefreshChange}
        />
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          aria-label={labels.toggleTheme}
          onClick={onToggleTheme}
        >
          {themeMounted ? (
            (resolvedTheme ?? theme) === 'dark' ? (
              <Sun className="mr-2 h-4 w-4" />
            ) : (
              <Moon className="mr-2 h-4 w-4" />
            )
          ) : (
            <span className="mr-2 inline-block h-4 w-4" aria-hidden />
          )}
          {labels.theme}
        </Button>
      </div>
    </div>
  )
}
