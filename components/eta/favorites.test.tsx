'use client'

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { FavoritesAndRecents } from '@/components/eta/favorites'
import { fireEvent, render, screen } from '@/lib/test-utils'
import { useAppStore, type FavoritesItem } from '@/lib/store'

const FIRST: FavoritesItem = {
  id: 'mtr:CEN',
  mode: 'mtr',
  title: 'Central',
  line: 'TWL',
  sta: 'CEN',
}
const SECOND: FavoritesItem = {
  id: 'mtr:ADM',
  mode: 'mtr',
  title: 'Admiralty',
  line: 'TWL',
  sta: 'ADM',
}

function seedFavorites(favorites: FavoritesItem[]) {
  useAppStore.setState({ favorites, favoritesGroups: [], recents: [] })
}

function renderFavorites() {
  return render(<FavoritesAndRecents lang="en" onSelect={vi.fn()} />)
}

describe('FavoritesAndRecents reorder handle', () => {
  beforeEach(() => {
    seedFavorites([])
  })

  it('keeps a 44px handle with a screen-reader reorder hint', () => {
    seedFavorites([FIRST, SECOND])
    renderFavorites()
    const handles = screen.getAllByRole('button', { name: 'Drag to reorder' })
    expect(handles).toHaveLength(2)
    for (const handle of handles) {
      expect(handle.className).toMatch('min-h-[44px]')
      expect(handle.className).toMatch('min-w-[44px]')
      const hint = document.getElementById(handle.getAttribute('aria-describedby') ?? '')
      expect(hint?.textContent).toMatch('arrow key')
    }
  })

  it('moves entries with ArrowUp and ArrowDown', () => {
    seedFavorites([FIRST, SECOND])
    renderFavorites()
    const [first] = screen.getAllByRole('button', { name: 'Drag to reorder' })
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(useAppStore.getState().favorites.map((f) => f.id)).toEqual(['mtr:ADM', 'mtr:CEN'])
    const [top] = screen.getAllByRole('button', { name: 'Drag to reorder' })
    fireEvent.keyDown(top, { key: 'ArrowUp' })
    expect(useAppStore.getState().favorites.map((f) => f.id)).toEqual(['mtr:ADM', 'mtr:CEN'])
  })

  it('marks a lone handle as disabled', () => {
    seedFavorites([FIRST])
    renderFavorites()
    expect(
      screen.getByRole('button', { name: 'Drag to reorder' }).getAttribute('aria-disabled')
    ).toBe('true')
  })
})
