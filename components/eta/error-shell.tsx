'use client'

import Link from 'next/link'

import { Button } from '@/components/ui/button'
import { TopAppBar } from '@/components/eta/app-shell'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'

type ErrorCopy = {
  title?: string
  hint?: string
  actionLabel?: string
  onAction?: () => void
  actionHref?: string
}

type ErrorContentProps = ErrorCopy & {
  lang?: UiLanguage
}

/**
 * Standalone error page body without app chrome.
 * Used by app/global-error.tsx where the root layout is replaced,
 * and by app/not-found.tsx for the home link variant.
 */
export function ErrorContent({
  title,
  hint,
  actionLabel,
  onAction,
  actionHref,
  lang = 'tc',
}: ErrorContentProps) {
  const { t } = useTranslations(lang)
  const resolvedTitle = title ?? t('common.wentWrong')
  const resolvedHint = hint ?? t('common.wentWrongHint')
  const resolvedAction = actionLabel ?? t('common.tryAgain')

  return (
    <div className="bg-surface relative min-h-dvh">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="relative mx-auto w-full max-w-[var(--app-max)] px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex min-h-[60vh] flex-col justify-center">
          <div role="alert" className="max-w-2xl space-y-4">
            <h1 className="text-2xl font-semibold">{resolvedTitle}</h1>
            <p className="text-muted-foreground text-sm">{resolvedHint}</p>
            {actionHref ? (
              <Button type="button" asChild className="min-h-[44px]">
                <Link href={actionHref}>{resolvedAction}</Link>
              </Button>
            ) : (
              <Button type="button" onClick={onAction} className="min-h-[44px]">
                {resolvedAction}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

type ErrorShellProps = ErrorCopy

/**
 * Full error page with TopAppBar chrome wired to the global store.
 */
export function ErrorShell({ title, hint, actionLabel, onAction, actionHref }: ErrorShellProps) {
  const lang = useAppStore((s) => s.lang)
  const mode = useAppStore((s) => s.mode)
  const setMode = useAppStore((s) => s.setMode)
  const { t } = useTranslations(lang)

  return (
    <div className="bg-surface min-h-dvh">
      <TopAppBar lang={lang} mode={mode} onModeChange={setMode} />
      <ErrorContent
        title={title ?? t('common.wentWrong')}
        hint={hint ?? t('common.wentWrongHint')}
        actionLabel={actionLabel ?? t('common.tryAgain')}
        onAction={onAction}
        actionHref={actionHref}
        lang={lang}
      />
    </div>
  )
}
