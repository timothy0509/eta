'use client'

import { fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'

function Harness() {
  const [expanded, setExpanded] = useState(false)
  return (
    <ExpandableEtaRow
      expanded={expanded}
      onToggle={() => setExpanded((v) => !v)}
      toggleLabel="Toggle panel"
      panel={<div>panel body</div>}
    >
      <div>row body</div>
    </ExpandableEtaRow>
  )
}

describe('ExpandableEtaRow', () => {
  it('toggles grid rows and keeps aria wiring', () => {
    const { getByLabelText, container } = render(<Harness />)
    const button = getByLabelText('Toggle panel')
    const panel = container.querySelector('[id]')
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(panel?.getAttribute('aria-hidden')).toBe('true')
    expect(panel?.className).toContain('grid-rows-[0fr]')

    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(panel?.getAttribute('aria-hidden')).toBe('false')
    expect(panel?.className).toContain('grid-rows-[1fr]')
  })
})
