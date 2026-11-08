'use client'

import * as React from 'react'

import { loadFareIndex } from '@/lib/eta/fares/loader'
import type { FareIndex } from '@/lib/eta/fares/types'

/** Load the fare matrix once; returns null until loaded or on failure. */
export function useFareIndex(): FareIndex | null {
  const [index, setIndex] = React.useState<FareIndex | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void loadFareIndex().then((loaded) => {
      if (!cancelled) setIndex(loaded)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return index
}
