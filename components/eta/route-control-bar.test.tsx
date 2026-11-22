'use client'

import { act, fireEvent } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  RouteControlBar,
  RouteVariantSelect,
  type RouteControlOption,
} from '@/components/eta/route-control-bar'
import { render } from '@/lib/test-utils'

const OPTIONS: RouteControlOption[] = [
  {
    key: 'kmb|14D|O|1',
    co: 'kmb',
    bound: 'O',
    serviceType: '1',
    operators: ['kmb'],
    origin: { en: 'Yau Tong', tc: '油塘', sc: '油塘' },
    destination: { en: 'Choi Hung', tc: '彩虹', sc: '彩虹' },
  },
  {
    key: 'kmb|14D|I|1',
    co: 'kmb',
    bound: 'I',
    serviceType: '1',
    operators: ['kmb'],
    origin: { en: 'Choi Hung', tc: '彩虹', sc: '彩虹' },
    destination: { en: 'Yau Tong', tc: '油塘', sc: '油塘' },
  },
  {
    key: 'kmb|14D|O|2',
    co: 'kmb',
    bound: 'O',
    serviceType: '2',
    operators: ['kmb'],
    origin: { en: 'Yau Tong', tc: '油塘', sc: '油塘' },
    destination: { en: 'Choi Hung', tc: '彩虹', sc: '彩虹' },
  },
]

describe('RouteVariantSelect', () => {
  it('shows the current direction and destination on the trigger', () => {
    const { getByRole, unmount } = render(
      <RouteVariantSelect
        lang="en"
        options={OPTIONS}
        currentKey={OPTIONS[0]!.key}
        onSelect={() => {}}
      />
    )
    expect(getByRole('button', { name: 'Outbound Choi Hung' })).not.toBeNull()
    unmount()
  })

  it('opens the variant menu and selects another option', () => {
    const onSelect = vi.fn()
    const { getByRole, getAllByRole, queryByRole, unmount } = render(
      <RouteVariantSelect
        lang="en"
        options={OPTIONS}
        currentKey={OPTIONS[0]!.key}
        onSelect={onSelect}
      />
    )
    fireEvent.click(getByRole('button', { name: 'Outbound Choi Hung' }))
    const items = getAllByRole('option')
    expect(items).toHaveLength(3)
    expect(items[0]!.getAttribute('aria-selected')).toBe('true')
    fireEvent.click(items[1]!)
    expect(onSelect).toHaveBeenCalledWith(OPTIONS[1])
    expect(queryByRole('listbox')).toBeNull()
    unmount()
  })

  it('disables the trigger when there is only one variant', () => {
    const { getByRole, queryByRole, unmount } = render(
      <RouteVariantSelect
        lang="en"
        options={[OPTIONS[0]!]}
        currentKey={OPTIONS[0]!.key}
        onSelect={() => {}}
      />
    )
    expect(
      getByRole('button', { name: 'Outbound Choi Hung' }).getAttribute('disabled')
    ).not.toBeNull()
    fireEvent.click(getByRole('button', { name: 'Outbound Choi Hung' }))
    expect(queryByRole('listbox')).toBeNull()
    unmount()
  })
})

describe('RouteControlBar', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lays out the buttons at 2:1:1 with labels shown when the destination fits', () => {
    const { getByRole, unmount } = render(
      <RouteControlBar
        lang="en"
        options={OPTIONS}
        currentKey={OPTIONS[0]!.key}
        onSelect={() => {}}
        variantKey="kmb|14D|O|1"
        onSave={() => {}}
      />
    )
    const trigger = getByRole('button', { name: 'Outbound Choi Hung' })
    expect(trigger.className).toContain('flex-[2_1_0%]')
    // No headway index loads in tests, so the timetable holds its 1-share
    // slot as a disabled placeholder instead of vanishing.
    const schedule = getByRole('button', { name: 'Timetable' })
    expect(schedule.getAttribute('disabled')).not.toBeNull()
    expect(schedule.className).toContain('flex-[1_1_0%]')
    // jsdom has no layout, so nothing overflows and both labels stay visible.
    const scheduleLabel = Array.from(schedule.querySelectorAll('span')).find((span) =>
      span.textContent?.includes('Timetable')
    )
    expect(scheduleLabel?.className ?? '').not.toContain('hidden')
    const save = getByRole('button', { name: 'Save' })
    expect(save.className).toContain('flex-[1_1_0%]')
    const label = Array.from(save.querySelectorAll('span')).find((span) =>
      span.textContent?.includes('Save')
    )
    expect(label?.className ?? '').not.toContain('hidden')
    expect(label?.className ?? '').not.toContain('truncate')
    unmount()
  })

  it('hides the side labels while the destination truncates, then restores them', () => {
    // jsdom has neither layout nor ResizeObserver: stub the observer and fake
    // the measurements the bar reads.
    const callbacks: Array<() => void> = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: () => void) {
          callbacks.push(callback)
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    )
    const { getByRole, getByText, unmount } = render(
      <RouteControlBar
        lang="en"
        options={OPTIONS}
        currentKey={OPTIONS[0]!.key}
        onSelect={() => {}}
        variantKey="kmb|14D|O|1"
        onSave={() => {}}
      />
    )
    const destination = getByText('Choi Hung')
    const buttonOf = (name: string) => getByRole('button', { name })
    const labelOf = (name: string) =>
      Array.from(buttonOf(name).querySelectorAll('span')).find((span) =>
        span.textContent?.includes(name)
      )!
    const fakeDestination = (clientWidth: number) => {
      Object.defineProperty(destination, 'scrollWidth', { value: 300, configurable: true })
      Object.defineProperty(destination, 'clientWidth', { value: clientWidth, configurable: true })
    }
    const fakeSides = (width: number) => {
      for (const button of [buttonOf('Timetable'), buttonOf('Save')]) {
        Object.defineProperty(button, 'offsetWidth', { value: width, configurable: true })
      }
    }

    // Destination overflows while expanded: both buttons collapse to icons
    // and drop their 1-share claim, but keep their names.
    fakeSides(100)
    fakeDestination(120)
    act(() => {
      for (const callback of callbacks) callback()
    })
    expect(labelOf('Timetable').className).toContain('hidden')
    expect(labelOf('Save').className).toContain('hidden')
    expect(buttonOf('Timetable').className).toContain('flex-none')
    expect(buttonOf('Save').className).toContain('flex-none')
    expect(buttonOf('Timetable')).not.toBeNull()
    expect(buttonOf('Save')).not.toBeNull()

    // Slightly more room, still short of handing the recorded 112px back:
    // stays collapsed instead of flapping.
    fakeSides(44)
    fakeDestination(310)
    act(() => {
      for (const callback of callbacks) callback()
    })
    expect(labelOf('Timetable').className).toContain('hidden')
    expect(labelOf('Save').className).toContain('hidden')

    // Room covers the recorded widths with room to spare: labels return and
    // the 2:1:1 split is restored.
    fakeDestination(500)
    act(() => {
      for (const callback of callbacks) callback()
    })
    expect(labelOf('Timetable').className).not.toContain('hidden')
    expect(labelOf('Save').className).not.toContain('hidden')
    expect(buttonOf('Save').className).toContain('flex-[1_1_0%]')
    unmount()
  })
})
