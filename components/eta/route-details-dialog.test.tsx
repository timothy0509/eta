'use client'

import { describe, expect, it } from 'vitest'

import { render } from '@/lib/test-utils'
import {
  minsToDisplay,
  spanHhmmToDisplay,
  TimetableTable,
} from '@/components/eta/route-details-dialog'
import type { VariantSchedule } from '@/lib/eta/headway/types'

describe('minsToDisplay', () => {
  it('formats minutes since midnight as HH:MM', () => {
    expect(minsToDisplay(335)).toBe('05:35')
    expect(minsToDisplay(0)).toBe('00:00')
  })

  it('wraps after-midnight windows past 1440', () => {
    expect(minsToDisplay(1470)).toBe('00:30')
  })
})

describe('spanHhmmToDisplay', () => {
  it('inserts a colon into HHMM spans', () => {
    expect(spanHhmmToDisplay('0535')).toBe('05:35')
    expect(spanHhmmToDisplay('805')).toBe('08:05')
  })

  it('passes through non-numeric input', () => {
    expect(spanHhmmToDisplay('—')).toBe('—')
  })
})

const SCHEDULE: VariantSchedule = {
  src: ['1001'],
  span: { weekday: ['0535', '2305'] },
  headway: {
    weekday: [
      [335, 425, 9],
      [425, 540, 6],
    ],
  },
}

describe('TimetableTable', () => {
  it('renders first/last plus one row per headway window', () => {
    const { getAllByText, getByText } = render(
      <TimetableTable schedule={SCHEDULE} dayType="weekday" lang="en" />
    )
    expect(getByText('05:35')).not.toBeNull()
    expect(getByText('23:05')).not.toBeNull()
    expect(getAllByText('05:35–07:05').length).toBeGreaterThanOrEqual(1)
    expect(getByText('Every ~9 min')).not.toBeNull()
    expect(getByText('07:05–09:00')).not.toBeNull()
  })

  it('falls back to the weekday table when the day-type table is missing', () => {
    const { getAllByText } = render(
      <TimetableTable schedule={SCHEDULE} dayType="sunday" lang="en" />
    )
    expect(getAllByText('05:35–07:05').length).toBeGreaterThanOrEqual(1)
  })

  it('shows the empty state when neither windows nor span exist', () => {
    const empty: VariantSchedule = { src: ['x'], span: {} }
    const { getByText } = render(<TimetableTable schedule={empty} dayType="weekday" lang="en" />)
    expect(getByText('No timetable available')).not.toBeNull()
  })
})
