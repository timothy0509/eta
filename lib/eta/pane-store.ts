'use client'

import { create } from 'zustand'
import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'
import type { KmbStopSearchItem } from '@/lib/eta/types'

type PaneStore = {
  kmb: KmbPaneState | null
  mtr: MtrPaneState | null
  lrt: LrtPaneState | null
  kmbStops: KmbStopSearchItem[]
  setKmbStops: (stops: KmbStopSearchItem[]) => void
}

export const usePaneStore = create<PaneStore>()((set) => ({
  kmb: null,
  mtr: null,
  lrt: null,
  kmbStops: [],
  setKmbStops: (stops) => set({ kmbStops: stops }),
}))
