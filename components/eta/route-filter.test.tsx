'use client'

import { fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import {
  countActiveFilters,
  RouteFilter,
  type RouteFilterState,
} from '@/components/eta/route-filter'

const OPTIONS = [
  { key: 'kmb|1A|O|1', route: '1A', label: '1A outbound' },
  { key: 'kmb|1A|I|1', route: '1A', label: '1A inbound' },
  { key: 'kmb|2|O|1', route: '2', label: '2 outbound' },
]

function Harness() {
  const [value, setValue] = useState<RouteFilterState>({ routes: '', entries: [] })
  return <RouteFilter lang="en" mode="simple" value={value} onChange={setValue} options={OPTIONS} />
}

describe('countActiveFilters', () => {
  it('counts entries first, then comma routes', () => {
    expect(countActiveFilters({ routes: '', entries: [] })).toBe(0)
    expect(countActiveFilters({ routes: '1A, 2', entries: [] })).toBe(2)
    expect(
      countActiveFilters({ routes: '1A', entries: [{ id: 'a', variantKey: 'kmb|1A|O|1' }] })
    ).toBe(1)
  })
})

describe('RouteFilter', () => {
  it('opens the variant row for multi-variant routes', () => {
    const { getAllByTitle, container, unmount } = render(<Harness />)
    fireEvent.click(getAllByTitle('1A outbound · 1A inbound')[0]!)
    expect(container.querySelector('.ui-chip-row-in')).not.toBeNull()
    unmount()
  })

  it('marks the active chip with the primary container', () => {
    const { getAllByTitle, container, unmount } = render(<Harness />)
    fireEvent.click(getAllByTitle('1A outbound · 1A inbound')[0]!)
    const variantButton = container.querySelector('.ui-chip-row-in [title="1A outbound"]')
    expect(variantButton).not.toBeNull()
    fireEvent.click(variantButton!)
    expect(variantButton?.className).toContain('bg-primary-container')
    unmount()
  })
})
