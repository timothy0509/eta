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
  { key: '1A|O|1', route: '1A', label: '1A outbound' },
  { key: '1A|I|1', route: '1A', label: '1A inbound' },
  { key: '2|O|1', route: '2', label: '2 outbound' },
]

function Harness() {
  const [value, setValue] = useState<RouteFilterState>({ routes: '', entries: [] })
  return <RouteFilter lang="en" mode="simple" value={value} onChange={setValue} options={OPTIONS} />
}

describe('countActiveFilters', () => {
  it('counts entries first, then comma routes', () => {
    expect(countActiveFilters({ routes: '', entries: [] })).toBe(0)
    expect(countActiveFilters({ routes: '1A, 2', entries: [] })).toBe(2)
    expect(countActiveFilters({ routes: '1A', entries: [{ id: 'a', variantKey: '1A|O|1' }] })).toBe(
      1
    )
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

describe('parseRouteVariantKey compat', () => {
  it('parses merged and legacy keys to the same route and direction', async () => {
    const { parseRouteVariantKey } = await import('@/lib/eta/eta-db-index')
    const merged = parseRouteVariantKey('101|O|1')
    const legacy = parseRouteVariantKey('kmb|101|O|1')
    expect(merged?.route).toBe('101')
    expect(legacy?.route).toBe('101')
    expect(merged?.bound).toBe('O')
    expect(legacy?.bound).toBe('O')
    expect(legacy?.co).toBe('kmb')
  })
})
