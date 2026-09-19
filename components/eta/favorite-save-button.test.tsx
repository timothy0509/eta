'use client'

import { fireEvent } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import { FavoriteSaveButton } from '@/components/eta/favorite-save-button'

describe('FavoriteSaveButton', () => {
  it('stays still on mount and pops only after a click', () => {
    let saves = 0
    const { container } = render(<FavoriteSaveButton onSave={() => saves++} label="Save" />)
    expect(container.querySelector('.ui-fav-pop')).toBeNull()

    fireEvent.click(container.querySelector('button')!)
    expect(saves).toBe(1)
    expect(container.querySelector('.ui-fav-pop')).not.toBeNull()
  })

  it('respects disabled', () => {
    const { container } = render(<FavoriteSaveButton onSave={() => {}} label="Save" disabled />)
    expect(container.querySelector('button')?.getAttribute('disabled')).not.toBeNull()
  })
})
