import { afterEach, describe, expect, it, vi } from 'vitest'

import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { tdTrafficKey } from '@/lib/eta/cache/keys'
import { getTdTrafficAlerts, parseTdTrafficXml } from './td-traffic'

const FIXTURE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
  <message>
    <INCIDENT_NUMBER>IN-26-00001</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>道路事故</INCIDENT_HEADING_CN>
    <INCIDENT_DETAIL_EN>Traffic Accident</INCIDENT_DETAIL_EN>
    <INCIDENT_DETAIL_CN>交通意外</INCIDENT_DETAIL_CN>
    <LOCATION_EN>Island Eastern Corridor</LOCATION_EN>
    <LOCATION_CN>東區走廊</LOCATION_CN>
    <DISTRICT_EN>Eastern</DISTRICT_EN>
    <DISTRICT_CN>東區</DISTRICT_CN>
    <DIRECTION_EN>Central</DIRECTION_EN>
    <DIRECTION_CN>中環</DIRECTION_CN>
    <ANNOUNCEMENT_DATE>2026-09-13T15:46:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>NEW</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>最新情況</INCIDENT_STATUS_CN>
    <ID>146050</ID>
    <CONTENT_EN>Due to traffic accident, part of the lanes near North Point is closed.</CONTENT_EN>
    <CONTENT_CN>因交通意外，北角附近部份行車線現已封閉。</CONTENT_CN>
    <LATITUDE>22.29</LATITUDE>
    <LONGITUDE>114.22</LONGITUDE>
  </message>
  <message>
    <INCIDENT_NUMBER>IN-26-00002</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Vehicle On Fire</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>車輛着火</INCIDENT_HEADING_CN>
    <INCIDENT_DETAIL_EN>Vehicle On Fire</INCIDENT_DETAIL_EN>
    <INCIDENT_DETAIL_CN>車輛着火</INCIDENT_DETAIL_CN>
    <LOCATION_EN>Tuen Mun Road</LOCATION_EN>
    <LOCATION_CN>屯門公路</LOCATION_CN>
    <DISTRICT_EN></DISTRICT_EN>
    <DISTRICT_CN></DISTRICT_CN>
    <DIRECTION_EN>Tuen Mun</DIRECTION_EN>
    <DIRECTION_CN>屯門</DIRECTION_CN>
    <ANNOUNCEMENT_DATE>2026-09-13T15:56:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>UPDATED</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>更新情況</INCIDENT_STATUS_CN>
    <ID>146052</ID>
    <CONTENT_EN>Due to vehicle on fire, part of the lanes near Sham Tseng is closed.</CONTENT_EN>
    <CONTENT_CN>因車輛着火，深井附近部份行車線現已封閉。</CONTENT_CN>
    <LATITUDE></LATITUDE>
    <LONGITUDE></LONGITUDE>
  </message>
  <message>
    <INCIDENT_NUMBER>IN-26-00003</INCIDENT_NUMBER>
    <INCIDENT_HEADING_EN>Road Incident</INCIDENT_HEADING_EN>
    <INCIDENT_HEADING_CN>道路事故</INCIDENT_HEADING_CN>
    <LOCATION_EN>Cleared Road</LOCATION_EN>
    <LOCATION_CN>已解封道路</LOCATION_CN>
    <ANNOUNCEMENT_DATE>2026-09-13T14:00:00</ANNOUNCEMENT_DATE>
    <INCIDENT_STATUS_EN>CLEARED</INCIDENT_STATUS_EN>
    <INCIDENT_STATUS_CN>已清理</INCIDENT_STATUS_CN>
    <ID>146000</ID>
    <CONTENT_EN>Traffic has resumed normal.</CONTENT_EN>
    <CONTENT_CN>交通已回復正常。</CONTENT_CN>
  </message>
</list>`

const EMPTY_FEED_XML = `<?xml version="1.0" encoding="UTF-8"?>
<list xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="https://www.td.gov.hk/en/special_news/trafficnews.xsd">
</list>`

function mockFeedResponse(xml: string) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(xml, { status: 200, headers: { 'content-type': 'application/xml' } })
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('parseTdTrafficXml', () => {
  it('parses two live records to id, heading, location, and date', () => {
    const records = parseTdTrafficXml(FIXTURE_XML, 'en')

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      id: 'IN-26-00001',
      heading: 'Road Incident',
      location: 'Island Eastern Corridor',
      date: '2026-09-13T15:46:00',
      status: 'NEW',
    })
    expect(records[1]).toMatchObject({
      id: 'IN-26-00002',
      heading: 'Vehicle On Fire',
      location: 'Tuen Mun Road',
      date: '2026-09-13T15:56:00',
      status: 'UPDATED',
    })
  })

  it('reads detail, district, direction, and coords from the first record', () => {
    const records = parseTdTrafficXml(FIXTURE_XML, 'en')

    expect(records[0]).toMatchObject({
      detail: 'Due to traffic accident, part of the lanes near North Point is closed.',
      district: 'Eastern',
      direction: 'Central',
      lat: 22.29,
      lng: 114.22,
    })
    expect(records[1]).toMatchObject({ district: '', lat: null, lng: null })
  })

  it('reads Chinese fields for tc', () => {
    const records = parseTdTrafficXml(FIXTURE_XML, 'tc')

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({ heading: '道路事故', location: '東區走廊' })
  })

  it('filters out cleared incidents', () => {
    const records = parseTdTrafficXml(FIXTURE_XML, 'en')

    expect(records.map((record) => record.id)).not.toContain('IN-26-00003')
  })

  it('returns an empty array for an empty feed', () => {
    expect(parseTdTrafficXml(EMPTY_FEED_XML, 'en')).toEqual([])
  })

  it('returns an empty array for malformed XML', () => {
    expect(parseTdTrafficXml('<list><message><oops', 'en')).toEqual([])
    expect(parseTdTrafficXml('', 'en')).toEqual([])
    expect(parseTdTrafficXml('not xml at all <<<', 'en')).toEqual([])
  })
})

describe('getTdTrafficAlerts', () => {
  it('fetches and parses the live feed', async () => {
    mockFeedResponse(FIXTURE_XML)

    const records = await getTdTrafficAlerts('en')

    expect(records).toHaveLength(2)
    expect(records[0]?.id).toBe('IN-26-00001')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.td.gov.hk/en/special_news/trafficnews.xml',
      expect.anything()
    )
  })

  it('returns an empty array on fetch failure and never throws', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'))

    await expect(getTdTrafficAlerts('sc')).resolves.toEqual([])
  })
})

describe('td traffic cache', () => {
  it('keys entries by normalized lang', () => {
    expect(tdTrafficKey('en')).toBe('td-traffic:en')
    expect(tdTrafficKey('EN')).toBe('td-traffic:en')
    expect(tdTrafficKey('tc')).not.toBe(tdTrafficKey('en'))
  })

  it('uses a 60s ttl with no persistence', () => {
    expect(CACHE_POLICIES.tdTraffic.ttlMs).toBe(60_000)
    expect(CACHE_POLICIES.tdTraffic.persist).toBe(false)
  })
})
