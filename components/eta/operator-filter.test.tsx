'use client'

import { fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { OperatorFilter } from '@/components/eta/operator-filter'
import { render } from '@/lib/test-utils'

const OPERATORS = [
  { code: 'KMB', count: 747 },
  { code: 'GMB', count: 575 },
]

function Harness({
  initial = [],
  onChangeSpy,
}: {
  initial?: string[]
  onChangeSpy?: (codes: string[]) => void
}) {
  const [value, setValue] = useState<string[]>(initial)
  return (
    <OperatorFilter
      operators={OPERATORS}
      total={1780}
      value={value}
      lang="en"
      onChange={(codes) => {
        setValue(codes)
        onChangeSpy?.(codes)
      }}
    />
  )
}

describe('OperatorFilter', () => {
  it('renders a single filter button instead of inline chips', () => {
    const { getByRole, queryByRole, unmount } = render(<Harness />)
    expect(getByRole('button', { name: 'Operator' })).not.toBeNull()
    // Checklist stays hidden until the button opens it.
    expect(queryByRole('checkbox')).toBeNull()
    unmount()
  })

  it('opens a checklist and toggles one operator on', () => {
    const onChange = vi.fn()
    const { getByRole, getAllByRole, unmount } = render(<Harness onChangeSpy={onChange} />)
    fireEvent.click(getByRole('button', { name: 'Operator' }))
    const boxes = getAllByRole('checkbox')
    expect(boxes).toHaveLength(3) // All + KMB + GMB
    fireEvent.click(boxes[1]!)
    expect(onChange).toHaveBeenCalledWith(['kmb'])
    unmount()
  })

  it('shows a count badge and clears back to All', () => {
    const onChange = vi.fn()
    const { getByRole, getAllByRole, unmount } = render(
      <Harness initial={['kmb']} onChangeSpy={onChange} />
    )
    expect(getByRole('button', { name: '1 operators' })).not.toBeNull()
    fireEvent.click(getByRole('button', { name: '1 operators' }))
    // Unchecking the active operator returns to All (empty value).
    fireEvent.click(getAllByRole('checkbox')[1]!)
    expect(onChange).toHaveBeenCalledWith([])
    unmount()
  })
})
