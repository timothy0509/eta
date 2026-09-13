import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@/lib/test-utils'

import { EtaRealtimeBadge, SortByTimeToggle, WheelchairBadge } from './eta-card-parts'

describe('EtaRealtimeBadge', () => {
  it('renders the realtime label', () => {
    render(<EtaRealtimeBadge badge="realtime" lang="en" />)
    expect(screen.getByText('Real-time')).toBeDefined()
  })

  it('renders the scheduled label', () => {
    render(<EtaRealtimeBadge badge="scheduled" lang="tc" />)
    expect(screen.getByText('原定班次')).toBeDefined()
  })
})

describe('WheelchairBadge', () => {
  it('stays hidden when no wheelchair flag was parsed', () => {
    const { container } = render(<WheelchairBadge visible={false} lang="en" />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the low-floor marker when parsed', () => {
    render(<WheelchairBadge visible lang="en" />)
    expect(screen.getByLabelText('Low-floor')).toBeDefined()
  })
})

describe('SortByTimeToggle', () => {
  it('fires onToggle and reflects the pressed state', () => {
    const onToggle = vi.fn()
    const { rerender } = render(<SortByTimeToggle active={false} onToggle={onToggle} lang="en" />)
    const button = screen.getByRole('button', { name: 'Sort by time' })
    expect(button.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(button)
    expect(onToggle).toHaveBeenCalledTimes(1)

    rerender(<SortByTimeToggle active onToggle={onToggle} lang="en" />)
    const pressed = screen.getByRole('button', { name: 'Route order' })
    expect(pressed.getAttribute('aria-pressed')).toBe('true')
  })
})
