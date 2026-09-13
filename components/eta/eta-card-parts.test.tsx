import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@/lib/test-utils'

import { EtaRealtimeBadge, SortByTimeToggle, etaNumeralClass } from './eta-card-parts'

describe('EtaRealtimeBadge', () => {
  it('renders the realtime label', () => {
    render(<EtaRealtimeBadge badge="realtime" lang="en" />)
    expect(screen.getByText('Real-time')).toBeDefined()
  })

  it('renders the scheduled label', () => {
    render(<EtaRealtimeBadge badge="scheduled" lang="tc" />)
    expect(screen.getByText('原定班次')).toBeDefined()
  })

  it('uses distinct pill classes for realtime vs scheduled', () => {
    const { container: realtimeContainer, unmount } = render(
      <EtaRealtimeBadge badge="realtime" lang="en" />
    )
    const realtimeClass = (realtimeContainer.firstChild as HTMLElement).className
    unmount()
    const { container: scheduledContainer } = render(
      <EtaRealtimeBadge badge="scheduled" lang="en" />
    )
    const scheduledClass = (scheduledContainer.firstChild as HTMLElement).className
    expect(realtimeClass).not.toBe(scheduledClass)
  })
})

describe('etaNumeralClass', () => {
  it('is green when due within 2 min', () => {
    expect(etaNumeralClass(2, 'realtime')).toBe('eta-numeral eta-numeral-soon')
  })

  it('is blue for normal realtime departures', () => {
    expect(etaNumeralClass(5, 'realtime')).toBe('eta-numeral eta-numeral-normal')
  })

  it('is amber for scheduled departures', () => {
    expect(etaNumeralClass(5, 'scheduled')).toBe('eta-numeral eta-numeral-scheduled')
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
