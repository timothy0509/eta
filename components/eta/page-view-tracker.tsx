'use client'

import * as React from 'react'

import { trackPageView } from '@/lib/analytics'
import { usePathname } from 'next/navigation'

export function PageViewTracker() {
  const pathname = usePathname()

  React.useEffect(() => {
    trackPageView(pathname)
  }, [pathname])

  return null
}
