'use client'

import { ThemeProvider } from 'next-themes'
import { describe, expect, it, beforeEach, vi } from 'vitest'

import { act, fireEvent, render, screen } from '@/lib/test-utils'
import { SettingsView } from '@/components/eta/views/settings-view'
import { useAppStore } from '@/lib/store'

// The settings view switches layouts at the Tailwind lg breakpoint via
// matchMedia. jsdom has no real media queries, so tests pick a side and can
// flip it to exercise breakpoint-change behavior.
const DESKTOP_QUERY = '(min-width: 1024px)'

type MediaController = {
  setDesktop: (desktop: boolean) => void
}

function mockMatchMedia(desktop = false): MediaController {
  let matchesDesktop = desktop
  const changeHandlers: Array<() => void> = []
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      get matches() {
        return matchesDesktop && query === DESKTOP_QUERY
      },
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: (_event: string, handler: () => void) => {
        if (query === DESKTOP_QUERY) changeHandlers.push(handler)
      },
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  return {
    setDesktop(value: boolean) {
      matchesDesktop = value
      for (const handler of changeHandlers) handler()
    },
  }
}

function renderSettings() {
  return render(
    <ThemeProvider attribute="class">
      <SettingsView lang="en" />
    </ThemeProvider>
  )
}

describe('SettingsView', () => {
  beforeEach(() => {
    mockMatchMedia(false)
    useAppStore.setState({
      lang: 'en',
      autoRefreshSeconds: 15,
      nearbyRadiusKm: 2,
      favorites: [],
      favoritesGroups: [],
      recents: [],
    })
  })

  it('lists every category in the desktop sidebar and shows one panel at a time', () => {
    mockMatchMedia(true)
    renderSettings()
    for (const label of [
      'Appearance',
      'Language',
      'Auto Refresh',
      'Route information',
      'Nearby',
      'Timetable detail',
      'Saved data',
      'Storage',
      'About',
    ]) {
      expect(screen.getByRole('tab', { name: label })).not.toBeNull()
    }
    // Default panel is appearance; other panels stay hidden.
    expect(screen.getByRole('heading', { name: 'Appearance' })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Storage' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Storage' }))
    expect(screen.getByRole('heading', { name: 'Storage' })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Appearance' })).toBeNull()
    expect(document.body.textContent).not.toMatch(/settings\.[a-zA-Z]+/)
    expect(document.body.textContent).not.toMatch(/common\.[a-zA-Z]+/)
  })

  it('renders a mobile accordion with one section open at a time', () => {
    renderSettings()
    // No desktop tab strip on mobile.
    expect(screen.queryByRole('tab')).toBeNull()
    for (const label of ['Appearance', 'Saved data', 'Storage', 'About']) {
      expect(screen.getByRole('button', { name: label })).not.toBeNull()
    }
    // Appearance is expanded by default; collapsed sections stay out of the
    // accessibility tree along with their controls.
    expect(screen.getByRole('region', { name: 'Appearance' })).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Saved data' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear search history' })).toBeNull()
    // Expanding a section reveals its controls and collapses the previous one.
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
    expect(screen.getByRole('region', { name: 'Saved data' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Clear search history' })).not.toBeNull()
    expect(screen.queryByRole('region', { name: 'Appearance' })).toBeNull()
    // Tapping the open header collapses it again.
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
    expect(screen.queryByRole('region', { name: 'Saved data' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Clear search history' })).toBeNull()
  })

  it('falls back to the first category when a collapsed mobile view grows to desktop', () => {
    const media = mockMatchMedia()
    renderSettings()
    // Collapse the open section so no category stays active.
    fireEvent.click(screen.getByRole('button', { name: 'Appearance' }))
    expect(screen.queryByRole('region')).toBeNull()
    // Grow past the lg breakpoint: the desktop panel must not stay empty.
    act(() => media.setDesktop(true))
    const appearanceTab = screen.getByRole('tab', { name: 'Appearance' })
    expect(appearanceTab.getAttribute('aria-selected')).toBe('true')
    expect(screen.getByRole('heading', { name: 'Appearance' })).not.toBeNull()
    expect(screen.queryByRole('heading', { name: 'Storage' })).toBeNull()
  })

  it('changes the persisted nearby radius', () => {
    mockMatchMedia(true)
    renderSettings()
    fireEvent.click(screen.getByRole('tab', { name: 'Nearby' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
    const clearButton = screen.getByRole('button', { name: 'Clear search history' })
    fireEvent.click(clearButton)
    expect(useAppStore.getState().recents).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Tap again to confirm' }))
    expect(useAppStore.getState().recents).toHaveLength(0)
  })

  it('shows a notice after clearing the cache', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Storage' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear cached timetables' }))
    const status = await screen.findByRole('status')
    expect(status.textContent).toBe('Cache cleared.')
  })

  it('reports skipped entries on a partial import', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
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
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
    const file = new File(['[]'], 'empty.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import'), { target: { files: [file] } })
    expect(await screen.findByText('0 favorites ready')).not.toBeNull()
    expect(useAppStore.getState().favorites).toHaveLength(0)
  })

  it('rejects a non-array file', async () => {
    renderSettings()
    fireEvent.click(screen.getByRole('button', { name: 'Saved data' }))
    const file = new File(['{"favorites": []}'], 'bad.json', { type: 'application/json' })
    fireEvent.change(screen.getByLabelText('Import'), { target: { files: [file] } })
    expect(await screen.findByText('Could not read that file.')).not.toBeNull()
  })
})
