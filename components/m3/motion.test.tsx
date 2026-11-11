'use client'

import { beforeEach, describe, expect, it } from 'vitest'

import {
  __resetLivePulseSlotsForTests,
  LivePulse,
  MAX_ANIMATED_LIVE_PULSES,
} from '@/components/m3/motion'
import { render } from '@/lib/test-utils'

describe('LivePulse', () => {
  beforeEach(() => {
    __resetLivePulseSlotsForTests()
  })

  it('animates at most the capped number of dots concurrently', () => {
    const { container } = render(
      <div>
        {Array.from({ length: MAX_ANIMATED_LIVE_PULSES + 2 }, (_, i) => (
          <LivePulse key={i} />
        ))}
      </div>
    )
    // Overflow dots still render the solid dot, just without animation.
    expect(container.querySelectorAll('.live-pulse')).toHaveLength(MAX_ANIMATED_LIVE_PULSES)
    expect(container.querySelectorAll('.bg-primary.relative')).toHaveLength(
      MAX_ANIMATED_LIVE_PULSES + 2
    )
  })

  it('renders a static dot when animate is false', () => {
    const { container } = render(<LivePulse animate={false} />)
    expect(container.querySelector('.live-pulse')).toBeNull()
    expect(container.querySelector('.bg-primary.relative')).not.toBeNull()
  })

  it('releases slots on unmount so later dots animate', () => {
    const first = render(
      <div>
        {Array.from({ length: MAX_ANIMATED_LIVE_PULSES }, (_, i) => (
          <LivePulse key={i} />
        ))}
      </div>
    )
    expect(first.container.querySelectorAll('.live-pulse')).toHaveLength(MAX_ANIMATED_LIVE_PULSES)
    first.unmount()
    const second = render(
      <div>
        <LivePulse />
      </div>
    )
    expect(second.container.querySelectorAll('.live-pulse')).toHaveLength(1)
  })
})
