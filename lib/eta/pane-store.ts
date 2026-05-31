'use client'

import { create } from 'zustand'
import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'

type PaneStore = {
  kmb: KmbPaneState | null
  mtr: MtrPaneState | null
  lrt: LrtPaneState | null
}

export const usePaneStore = create<PaneStore>()(() => ({
  kmb: null,
  mtr: null,
  lrt: null,
}))
