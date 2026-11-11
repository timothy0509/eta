'use client'

import { describe, expect, it } from 'vitest'

import { formatIsoToExactHms } from '@/lib/eta/format'
import { render } from '@/lib/test-utils'
import { TickingKmbMinutes, TickingSoonestPill } from '@/components/eta/ticking-eta'

const NOW = Date.now()

function etaIso(minutesFromNow: number): string {
  return new Date(NOW + minutesFromNow * 60_000).toISOString()
}

describe('TickingKmbMinutes', () => {
  it('renders one tick node and keeps it across identical rerenders', () => {
    const eta = etaIso(5)
    const { container, rerender } = render(
      <TickingKmbMinutes eta={eta} dataTimestamp={new Date(NOW).toISOString()} lang="en" />
    )
    const first = container.querySelector('.ui-eta-tick')
    expect(first).not.toBeNull()
    rerender(<TickingKmbMinutes eta={eta} dataTimestamp={new Date(NOW).toISOString()} lang="en" />)
    expect(container.querySelector('.ui-eta-tick')).toBe(first)
  })

  it('replaces the tick node when minutes change', () => {
    const stamp = new Date(NOW).toISOString()
    const { container, rerender } = render(
      <TickingKmbMinutes eta={etaIso(5)} dataTimestamp={stamp} lang="en" />
    )
    const first = container.querySelector('.ui-eta-tick')
    rerender(<TickingKmbMinutes eta={etaIso(1)} dataTimestamp={stamp} lang="en" />)
    expect(container.querySelector('.ui-eta-tick')).not.toBe(first)
  })

  it('keeps the arriving pill shell with live pulse', () => {
    const { container } = render(
      <TickingKmbMinutes eta={etaIso(0)} dataTimestamp={new Date(NOW).toISOString()} lang="en" />
    )
    expect(container.querySelector('.live-pulse')).not.toBeNull()
    expect(container.querySelector('.ui-eta-tick')).not.toBeNull()
  })

  it('shows the exact hh:mm:ss arrival time in exact format', () => {
    const eta = etaIso(5)
    const { container } = render(
      <TickingKmbMinutes
        eta={eta}
        dataTimestamp={new Date(NOW).toISOString()}
        lang="en"
        format="exact"
      />
    )
    expect(container.textContent).toMatch(formatIsoToExactHms(eta) as string)
  })

  it('keeps the arriving pill in exact format', () => {
    const { container } = render(
      <TickingKmbMinutes
        eta={etaIso(0)}
        dataTimestamp={new Date(NOW).toISOString()}
        lang="en"
        format="exact"
      />
    )
    expect(container.querySelector('.live-pulse')).not.toBeNull()
  })

  it('plain variant renders tick text without pill classes', () => {
    const { container } = render(
      <TickingKmbMinutes
        eta={etaIso(5)}
        dataTimestamp={new Date(NOW).toISOString()}
        lang="en"
        variant="plain"
      />
    )
    expect(container.querySelector('.ui-eta-tick')).not.toBeNull()
    expect(container.querySelector('.bg-primary-container')).toBeNull()
  })
})

describe('TickingSoonestPill', () => {
  it('ticks the minutes text without a pill', () => {
    const stamp = new Date(NOW).toISOString()
    const { container } = render(
      <TickingSoonestPill etas={[{ eta: etaIso(5), data_timestamp: stamp }]} lang="en" />
    )
    expect(container.querySelector('.ui-eta-tick')).not.toBeNull()
    expect(container.querySelector('.live-pulse')).toBeNull()
    expect(container.querySelector('.bg-primary-container')).toBeNull()
  })

  it('keeps the arriving pill shell with live pulse', () => {
    const stamp = new Date(NOW).toISOString()
    const { container } = render(
      <TickingSoonestPill etas={[{ eta: etaIso(0), data_timestamp: stamp }]} lang="en" />
    )
    expect(container.querySelector('.ui-eta-tick')).not.toBeNull()
    expect(container.querySelector('.live-pulse')).not.toBeNull()
  })

  it('shows the exact hh:mm:ss arrival time in exact format', () => {
    const stamp = new Date(NOW).toISOString()
    const eta = etaIso(5)
    const { container } = render(
      <TickingSoonestPill etas={[{ eta, data_timestamp: stamp }]} lang="en" format="exact" />
    )
    expect(container.textContent).toMatch(formatIsoToExactHms(eta) as string)
  })
})
