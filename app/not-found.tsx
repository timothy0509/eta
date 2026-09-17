'use client'

import { ErrorShell } from '@/components/eta/error-shell'
import { useTranslations } from '@/lib/eta/i18n'
import { useAppStore } from '@/lib/store'

export default function NotFound() {
  const lang = useAppStore((s) => s.lang)
  const { t } = useTranslations(lang)

  return (
    <ErrorShell
      title={t('common.pageNotFound')}
      hint={t('common.pageNotFoundHint')}
      actionLabel={t('common.backHome')}
      actionHref="/"
    />
  )
}
