import dynamic from 'next/dynamic'

import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'

export const KmbPane = dynamic(
  () => import('@/components/eta/panes/kmb-pane').then((mod) => mod.KmbPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

export const MtrPane = dynamic(
  () => import('@/components/eta/panes/mtr-pane').then((mod) => mod.MtrPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

export const LrtPane = dynamic(
  () => import('@/components/eta/panes/lrt-pane').then((mod) => mod.LrtPane),
  {
    loading: () => <PaneSkeleton />,
    ssr: false,
  }
)

export const KmbResults = dynamic(
  () => import('@/components/eta/results-kmb').then((mod) => ({ default: mod.KmbResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

export const MtrResults = dynamic(
  () => import('@/components/eta/results-mtr').then((mod) => ({ default: mod.MtrResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

export const LrtResults = dynamic(
  () => import('@/components/eta/results-lrt').then((mod) => ({ default: mod.LrtResults })),
  {
    loading: () => <ResultsSkeleton />,
    ssr: false,
  }
)

export const FavoritesAndRecents = dynamic(
  () => import('@/components/eta/favorites').then((mod) => ({ default: mod.FavoritesAndRecents })),
  {
    ssr: false,
  }
)
