import { describe, expect, it } from 'vitest'

import { staggerClassForIndex } from '@/components/eta/stagger-list'

describe('staggerClassForIndex', () => {
  it('maps the first five items to staggered delays', () => {
    expect(staggerClassForIndex(0)).toBe('ui-stagger-1')
    expect(staggerClassForIndex(1)).toBe('ui-stagger-2')
    expect(staggerClassForIndex(2)).toBe('ui-stagger-3')
    expect(staggerClassForIndex(3)).toBe('ui-stagger-4')
    expect(staggerClassForIndex(4)).toBe('ui-stagger-5')
  })

  it('leaves later items without delay so long lists stay fast', () => {
    expect(staggerClassForIndex(5)).toBe('')
    expect(staggerClassForIndex(99)).toBe('')
  })
})
