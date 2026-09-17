'use client'

import * as React from 'react'

import { isLanguageSupported } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'

const resolveHtmlLang = (lang: string) => {
  if (lang === 'en') return 'en'
  if (lang === 'sc') return 'zh-Hans'
  return 'zh-Hant'
}

export function LangSync() {
  const lang = useAppStore((state) => state.lang)
  const mode = useAppStore((state) => state.mode)

  // Read-only gate: isLanguageSupported stays the single check for sc
  // support. When nav mode is MTR or LRT and saved lang is sc, reflect tc
  // in document lang without writing into prefs. Store resets and the
  // LanguageMenu disable plus tooltip behavior live elsewhere and are
  // untouched here.
  const supportedLang = isLanguageSupported(mode, lang) ? lang : 'tc'

  React.useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.lang = resolveHtmlLang(supportedLang)
  }, [supportedLang])

  return null
}
