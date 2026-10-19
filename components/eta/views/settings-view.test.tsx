'use client'

import { ThemeProvider } from 'next-themes'
import { describe, expect, it, beforeEach, vi } from 'vitest'

import { fireEvent, render, screen } from '@/lib/test-utils'
import { SettingsView } from '@/components/eta/views/settings-view'
import { useAppStore } from '@/lib/store'

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

function renderSettings() {
  return render(
    <ThemeProvider attribute="class">
      <SettingsView lang="en" />
    </ThemeProvider>
  )
}

describe('SettingsView', () => {
  beforeEach(() => {
    useAppStore.setState({
      lang: 'en',
      autoRefreshSeconds: 15,
      nearbyRadiusKm: 2,
      favorites: [],
      favoritesGroups: [],
      recents: [],
    })
  })

  it('renders every section with translated strings', () => {
    renderSettings()
    for (const heading of [
      'Settings',
      'Appearance',
      'Language',
      'Auto Refresh',
      'Nearby',
      'Saved data',
      'Storage',
      'About',
    ]) {
      expect(screen.getByRole('heading', { name: heading })).not.toBeNull()
    }
    expect(document.body.textContent).not.toMatch(/settings\.[a-zA-Z]+/)
    expect(document.body.textContent).not.toMatch(/common\.[a-zA-Z]+/)
  })

  it('changes the persisted nearby radius', () => {
    renderSettings()
    const slider = screen.getByLabelText('Search radius') as HTMLInputElement
    fireEvent.change(slider, { target: { value: '3.5' } })
    expect(useAppStore.getState().nearbyRadiusKm).toBe(3.5)
  })

  it('clears search history after a confirm tap', () => {
    useAppStore.getState().addRecent({
      id: 'mtr:CEN',
      mode: 'mtr',
      title: 'Central',
      line: 'TWL',
      sta: 'CEN',
    })
    renderSettings()
    const clearButton = screen.getByRole('button', { name: 'Clear search history' })
    fireEvent.click(clearButton)
    expect(useAppStore.getState().recents).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }))
    expect(useAppStore.getState().recents).toHaveLength(0)
  })

  it('reports skipped entries on a partial import', async () => {
    renderSettings()
    const file = new File(
      [
        JSON.stringify([
          { id: 'mtr:CEN', mode: 'mtr', title: 'Central', line: 'TWL', sta: 'CEN' },
          { id: 'broken', title: 'Missing mode' },
        ]),
      ],
      'favorites.json',
      { type: 'application/json' }
    )
    fireEvent.change(screen.getByLabelText('Import'), { target: { files: [file] } })
    expect(await screen.findByText('1 of 2 imported, 1 skipped')).not.toBeNull()
    expect(useAppStore.getState().favorites).toHaveLength(1)
  })

  it('accepts an empty array import and reports zero', async () => {
    useAppStore.setState({
      favorites: [{ id: 'mtr:CEN', mode: 'mtr', title: 'Central', line: 'TWL', sta: 'CEN' }],
    })
    renderSettings()
    const file = new File(['[]'], 'empty.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import'), { target: { files: [file] } })
    expect(await screen.findByText('0 favorites ready')).not.toBeNull()
    expect(useAppStore.getState().favorites).toHaveLength(0)
  })

  it('rejects a non-array file', async () => {
    renderSettings()
    const file = new File(['{"favorites": []}'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import'), { target: { files: [file] } })
    expect(await screen.findByText('Could not read that file.')).not.toBeNull()
  })
})
