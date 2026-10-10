'use client'

import { describe, expect, it, vi } from 'vitest'

import { fireEvent, render, within } from '@/lib/test-utils'
import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { GmbTdRouteGroup } from '@/lib/eta/direct/gmb-td'
import { GmbRouteDetail } from '@/components/eta/views/gmb-route-detail'

vi.mock('@/components/eta/transit-map', () => ({
  TransitMap: () => <div data-testid="transit-map-stub" />,
}))

const groupFixture: GmbTdRouteGroup = {
  routeId: 2000511,
  routeName: { en: '69X', tc: '69X', sc: '69X' },
  variants: [
    {
      routeId: 2000511,
      routeName: { en: '69X', tc: '69X', sc: '69X' },
      routeSeq: 1,
      district: 'HKI',
      serviceMode: 'R',
      origin: { en: 'Cyberport', tc: '數碼港', sc: '数码港' },
      destination: { en: 'Causeway Bay', tc: '銅鑼灣', sc: '铜锣湾' },
      journeyTime: 20,
      fullFare: 12.5,
      lastUpdateDate: '2026-09-28T00:00:00',
      stops: [
        {
          routeId: 2000511,
          routeName: { en: '69X', tc: '69X', sc: '69X' },
          routeSeq: 1,
          stopSeq: 1,
          stopId: 20003337,
          stopPickDrop: 2,
          stopName: { en: 'First Stop', tc: '第一站', sc: '第一站' },
          lat: 22.25,
          lng: 114.12,
        },
        {
          routeId: 2000511,
          routeName: { en: '69X', tc: '69X', sc: '69X' },
          routeSeq: 1,
          stopSeq: 2,
          stopId: 20007719,
          stopPickDrop: 3,
          stopName: { en: 'Second Stop', tc: '第二站', sc: '第二站' },
          lat: 22.26,
          lng: 114.13,
        },
        {
          routeId: 2000511,
          routeName: { en: '69X', tc: '69X', sc: '69X' },
          routeSeq: 1,
          stopSeq: 3,
          stopId: 20008888,
          stopPickDrop: 1,
          stopName: { en: 'Third Stop', tc: '第三站', sc: '第三站' },
          lat: 22.27,
          lng: 114.14,
        },
      ],
    },
    {
      routeId: 2000511,
      routeName: { en: '69X', tc: '69X', sc: '69X' },
      routeSeq: 2,
      district: 'HKI',
      serviceMode: 'R',
      origin: { en: 'Causeway Bay', tc: '銅鑼灣', sc: '铜锣湾' },
      destination: { en: 'Cyberport', tc: '數碼港', sc: '数码港' },
      journeyTime: 20,
      fullFare: 12.5,
      lastUpdateDate: '2026-09-28T00:00:00',
      stops: [
        {
          routeId: 2000511,
          routeName: { en: '69X', tc: '69X', sc: '69X' },
          routeSeq: 2,
          stopSeq: 1,
          stopId: 20009999,
          stopPickDrop: 3,
          stopName: { en: 'Back Stop', tc: '回程站', sc: '回程站' },
          lat: 22.28,
          lng: 114.15,
        },
      ],
    },
  ],
}

function etaEntry(stop: string, minutesFromNow: number): KmbEtaEntryWithLeg {
  return {
    co: 'gmb',
    route: '69X',
    dir: 'O',
    service_type: '1',
    seq: 1,
    stop,
    dest_en: 'Causeway Bay',
    dest_tc: '銅鑼灣',
    dest_sc: '铜锣湾',
    eta_seq: 1,
    eta: new Date(Date.now() + minutesFromNow * 60_000).toISOString(),
    rmk_en: '',
    rmk_tc: '',
    rmk_sc: '',
    data_timestamp: new Date().toISOString(),
    leg: null,
  }
}

vi.mock('@/lib/eta/direct/gmb-td', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/eta/direct/gmb-td')>()
  return {
    ...actual,
    getGmbTdRouteGroup: vi.fn(async () => groupFixture),
    listGmbTdRouteGroups: vi.fn(async () => [groupFixture]),
  }
})

vi.mock('@/lib/eta/direct/eta-db', () => ({
  getEtaDbIndexes: vi.fn(async () => ({
    kmbRouteListEntries: [
      {
        route: '69X',
        co: ['gmb'],
        bound: { gmb: 'O' },
        serviceType: '1',
        orig: { en: 'Cyberport', zh: '數碼港' },
        dest: { en: 'Causeway Bay', zh: '銅鑼灣' },
        stops: { gmb: ['ETA-1', 'ETA-2'] },
        fares: null,
        faresHoliday: null,
        freq: null,
        jt: null,
        seq: 1,
        nlbId: '',
        gtfsId: 'gtfs-69x',
      },
    ],
  })),
}))

vi.mock('@/lib/eta/client', () => ({
  fetchKmbStopEtas: vi.fn(async () => ({
    byStopId: {
      'ETA-1': [etaEntry('ETA-1', 5)],
      'ETA-2': [etaEntry('ETA-2', 12)],
    },
    errors: [],
    cached: 0,
    fetched: 2,
  })),
}))

describe('GmbRouteDetail', () => {
  it('shows stops in stopSeq order with fare, journey time and map', async () => {
    const rendered = render(<GmbRouteDetail routeId={2000511} lang="tc" />)

    expect(await rendered.findByText('第一站')).not.toBeNull()
    expect(rendered.getByText(/HK\$ 12\.5/)).not.toBeNull()
    expect(rendered.getByText(/車程約 20 分鐘/)).not.toBeNull()
    expect(await rendered.findByTestId('transit-map-stub')).not.toBeNull()

    const timeline = (await rendered.findByText('第一站')).closest('.space-y-2')
    expect(timeline).not.toBeNull()
    const names = within(timeline as HTMLElement)
      .getAllByText(/第[一二三]站/)
      .map((el) => el.textContent)
    expect(names).toEqual(['第一站', '第二站', '第三站'])
    rendered.unmount()
  })

  it('flags stops past the realtime list instead of guessing ETAs', async () => {
    const rendered = render(<GmbRouteDetail routeId={2000511} lang="tc" />)

    expect(await rendered.findByText('第一站')).not.toBeNull()
    // Third TD stop has no realtime counterpart (only two ETA ids resolve).
    const card = rendered.getByText('第三站').closest('.ui-cv-row')
    expect(card?.textContent).toContain('只可下車')
    fireEvent.click(rendered.getByRole('button', { name: '第三站' }))
    expect(await rendered.findByText('實時索引中沒有此站，未能提供到站預報。')).not.toBeNull()
    rendered.unmount()
  })

  it('switches between outbound and inbound legs', async () => {
    const rendered = render(<GmbRouteDetail routeId={2000511} lang="tc" />)

    expect(await rendered.findByText('第一站')).not.toBeNull()
    fireEvent.click(rendered.getByRole('button', { name: '回程' }))
    expect(await rendered.findByText('回程站')).not.toBeNull()
    rendered.unmount()
  })
})
