'use client'

import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import { EmptyState } from '@/components/eta/empty-state'

describe('EmptyState', () => {
  it('announces politely and plays the entrance', () => {
    const { getByRole, getByText } = render(
      <EmptyState
        title="Nothing here"
        hint="Try another stop"
        action={<button type="button">Retry</button>}
      />
    )
    const status = getByRole('status')
    expect(status.classList.contains('ui-empty-in')).toBe(true)
    expect(getByText('Nothing here')).not.toBeNull()
    expect(getByText('Retry')).not.toBeNull()
  })
})
