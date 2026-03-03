'use client'

import * as React from 'react'

import { useAppStore } from '@/lib/store'

const resolveHtmlLang = (lang: string) => {
  if (lang === 'en') return 'en'
  if (lang === 'sc') return 'zh-Hans'
  return 'zh-Hant'
}

export function LangSync() {
  const lang = useAppStore((state) => state.lang)

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = resolveHtmlLang(lang)
  }, [lang])

  return null
}
