'use client'

import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { FareViewToggle } from '@/components/eta/fare-view-toggle'
import { render } from '@/lib/test-utils'

describe('FareViewToggle', () => {
  it('marks the active mode pressed and switches on click', () => {
    const onChange = vi.fn()
    const { getByRole, unmount } = render(
      <FareViewToggle lang="en" mode="sections" onChange={onChange} />
    )
    expect(getByRole('button', { name: 'Fare sections' }).getAttribute('aria-pressed')).toBe('true')
    expect(getByRole('button', { name: 'By boarding stop' }).getAttribute('aria-pressed')).toBe(
      'false'
    )
    fireEvent.click(getByRole('button', { name: 'By boarding stop' }))
    expect(onChange).toHaveBeenCalledWith('byStop')
    unmount()
  })

  it('renders localized labels', () => {
    const { getByRole, unmount } = render(
      <FareViewToggle lang="tc" mode="byStop" onChange={() => {}} />
    )
    expect(getByRole('button', { name: '分段車費' }).getAttribute('aria-pressed')).toBe('false')
    expect(getByRole('button', { name: '按上車站' }).getAttribute('aria-pressed')).toBe('true')
    unmount()
  })
})
