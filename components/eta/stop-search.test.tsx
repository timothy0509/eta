import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { StopSearch } from '@/components/eta/stop-search'
import type { KmbStopSearchItem } from '@/lib/eta/types'
import { render } from '@/lib/test-utils'

// cmdk measures its list with ResizeObserver and scrolls the active item
// into view; jsdom ships neither.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
  )
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {}
  }
})

function stop(stopId: string, nameEn: string, nameTc: string): KmbStopSearchItem {
  return { stopId, nameEn, nameTc, nameSc: nameTc, lat: 22.3, lng: 114.2, isKmb: true }
}

const STOPS: KmbStopSearchItem[] = [
  stop('A1', 'Abc Central Station (AB001)', 'ABC中環站'),
  stop('A2', 'Abc East Station (AB002)', 'ABC東站'),
  stop('B1', 'Xyz Terminal', 'XYZ總站'),
]

function Harness() {
  return (
    <StopSearch
      lang="en"
      stops={STOPS}
      onSelectStop={vi.fn()}
      onSelectStops={vi.fn()}
      onSelectContains={vi.fn()}
    />
  )
}

describe('StopSearch', () => {
  it('shows the default grouped list on open', async () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Abc Central Station')).not.toBeNull()
    expect(await screen.findByText('Xyz Terminal')).not.toBeNull()
    unmount()
  })

  it('swaps interim prefix rows for resolved fuzzy rows', async () => {
    const { unmount } = render(<Harness />)
    fireEvent.click(screen.getByRole('combobox'))
    const input = document.querySelector('input')
    expect(input).not.toBeNull()
    // 'abx' matches nothing by prefix, so only the resolved Fuse pass
    // brings the Abc rows back.
    fireEvent.change(input!, { target: { value: 'abx' } })
    expect(await screen.findByText('Abc Central Station')).not.toBeNull()
    unmount()
  })
})
