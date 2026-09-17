'use client'

import * as React from 'react'

import { ErrorContent } from '@/components/eta/error-shell'
import { useAppStore } from '@/lib/store'

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error('[App] Global error', error)
  }, [error])

  const lang = useAppStore((s) => s.lang)

  return (
    <html>
      <body className="bg-background text-foreground min-h-dvh antialiased">
        <ErrorContent lang={lang} onAction={reset} />
      </body>
    </html>
  )
}
