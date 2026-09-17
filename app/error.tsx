'use client'

import * as React from 'react'

import { ErrorShell } from '@/components/eta/error-shell'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  React.useEffect(() => {
    console.error('[App] Route error', error)
  }, [error])

  return <ErrorShell onAction={reset} />
}
