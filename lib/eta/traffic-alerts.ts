export type TrafficAlert = {
  id: string
  tc: string
  en: string
  sc: string
  link: string
}

const TD_SPECIAL_TRAFFIC_NEWS = 'https://www.td.gov.hk/en/special_news/spnews.htm'

/**
 * Static translated traffic alerts. There is no simple TD incident JSON
 * feed, so these entries point readers at the Transport Department
 * Special Traffic News page instead of inventing live incidents.
 */
export const TRAFFIC_ALERTS: TrafficAlert[] = [
  {
    id: 'td-special-traffic-news',
    tc: '請查閱運輸署特別交通消息，了解最新交通事故及道路狀況。',
    en: 'Check Transport Department Special Traffic News for the latest incidents and road conditions.',
    sc: '请查阅运输署特别交通消息，了解最新交通事故及道路状况。',
    link: TD_SPECIAL_TRAFFIC_NEWS,
  },
  {
    id: 'td-planned-works-notices',
    tc: '計劃中的道路工程及公共交通服務改動會於運輸署通告頁公布，出門前請先查閱。',
    en: 'Planned road works and public transport service changes are announced on the TD notices page.',
    sc: '计划中的道路工程及公共交通服务改动会于运输署通告页公布，出门前请先查阅。',
    link: TD_SPECIAL_TRAFFIC_NEWS,
  },
]

export function getTrafficAlerts(): TrafficAlert[] {
  return [...TRAFFIC_ALERTS]
}
