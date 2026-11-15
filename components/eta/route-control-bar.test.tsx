'use client'

import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

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
  it('lays out the buttons at 2:1:1 with collapsible labels on save', () => {
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
    const save = getByRole('button', { name: 'Save' })
    expect(save.className).toContain('flex-[1_1_0%]')
    const label = Array.from(save.querySelectorAll('span')).find((span) =>
      span.textContent?.includes('Save')
    )
    expect(label?.className ?? '').toContain('@max-[22.5rem]:hidden')
    expect(label?.className ?? '').toContain('whitespace-nowrap')
    expect(label?.className ?? '').not.toContain('truncate')
    unmount()
  })
})
