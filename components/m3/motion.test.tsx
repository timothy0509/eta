'use client'

import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EtaValue, PaneEnter } from '@/components/m3/motion'

describe('PaneEnter', () => {
  it('applies the pane entrance class', () => {
    const { container } = render(<PaneEnter>view</PaneEnter>)
    expect((container.firstChild as HTMLElement | null)?.classList.contains('ui-pane-enter')).toBe(
      true
    )
  })
})

describe('EtaValue', () => {
  it('renders the value with the tick class', () => {
    const { container } = render(<EtaValue key="5 min" value="5 min" />)
    const node = container.querySelector('.ui-eta-tick')
    expect(node?.textContent).toBe('5 min')
  })

  it('replaces the node when the key changes and keeps it when identical', () => {
    const { container, rerender } = render(<EtaValue key="5 min" value="5 min" />)
    const first = container.querySelector('.ui-eta-tick')
    rerender(<EtaValue key="5 min" value="5 min" />)
    expect(container.querySelector('.ui-eta-tick')).toBe(first)
    rerender(<EtaValue key="4 min" value="4 min" />)
    expect(container.querySelector('.ui-eta-tick')).not.toBe(first)
    expect(container.querySelector('.ui-eta-tick')?.textContent).toBe('4 min')
  })
})
