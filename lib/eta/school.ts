import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { UiLanguage } from '@/lib/eta/types'

export type SchoolLangText = { en: string; tc: string; sc: string }

export type SchoolSubgroup = {
  heading: SchoolLangText
  stopIds: string[]
}

export type SchoolLocationGroup = {
  id: string
  title: SchoolLangText
  subgroups: SchoolSubgroup[]
}

export const SCHOOL_GROUPS: SchoolLocationGroup[] = [
  {
    id: 'pak-hung-house',
    title: {
      en: 'Pak Hung House, Choi Wan Estate',
      tc: '彩雲邨白虹樓',
      sc: '彩云邨白虹楼',
    },
    subgroups: [
      {
        heading: { en: 'East Bound', tc: '往東行', sc: '往东行' },
        stopIds: ['29740CCBBD82FC33', '942E95B4336BDFA7', '9A16E73DC0B9AF6C'],
      },
      {
        heading: { en: 'West Bound', tc: '往西行', sc: '往西行' },
        stopIds: ['3BA9C90738A8600D', '58611212645F0AB1'],
      },
      {
        heading: { en: 'Citybus Westbound', tc: '城巴往西行', sc: '城巴往西行' },
        stopIds: ['001779'],
      },
      {
        heading: { en: 'Citybus Eastbound', tc: '城巴往東行', sc: '城巴往东行' },
        stopIds: ['001652'],
      },
    ],
  },
  {
    id: 'kai-yip-estate',
    title: { en: 'Kai Yip Estate', tc: '啟業邨', sc: '启业邨' },
    subgroups: [
      {
        heading: { en: 'East Bound', tc: '往東行', sc: '往东行' },
        stopIds: ['23AF5995FEBCA8E6', 'BA03816A38B9DA7F', 'D9B53E4B3A192940', 'F60097D67F33DC0C'],
      },
      {
        heading: { en: 'Citybus', tc: '城巴', sc: '城巴' },
        stopIds: ['001504'],
      },
    ],
  },
  {
    id: 'choi-hing-court',
    title: { en: 'Choi Hing Court', tc: '彩興苑', sc: '彩兴苑' },
    subgroups: [{ heading: { en: 'Stop', tc: '車站', sc: '车站' }, stopIds: ['53FCF9B3DFD6C9F2'] }],
  },
  {
    id: 'choi-wan-terminus',
    title: { en: 'Choi Wan Bus Terminus', tc: '彩雲巴士總站', sc: '彩云巴士总站' },
    subgroups: [
      {
        heading: { en: 'Terminus stops', tc: '總站車站', sc: '总站车站' },
        stopIds: ['09680C5849BFA077', '177A516A81E9DEA5', '6D1FFB57C26F1108'],
      },
      {
        heading: { en: 'Choi Wan Estate', tc: '彩雲邨', sc: '彩云邨' },
        stopIds: ['1EF5F9AB9266BD6C8'],
      },
    ],
  },
]

export const SCHOOL_ALL_STOP_IDS: string[] = Array.from(
  new Set(SCHOOL_GROUPS.flatMap((group) => group.subgroups.flatMap((sub) => sub.stopIds)))
)

export type SchoolStopLocation = {
  locationId: string
  location: SchoolLangText
  subgroup: SchoolLangText
}

export const SCHOOL_STOP_LOCATION = new Map<string, SchoolStopLocation>()
for (const group of SCHOOL_GROUPS) {
  for (const sub of group.subgroups) {
    for (const stopId of sub.stopIds) {
      if (!SCHOOL_STOP_LOCATION.has(stopId)) {
        SCHOOL_STOP_LOCATION.set(stopId, {
          locationId: group.id,
          location: group.title,
          subgroup: sub.heading,
        })
      }
    }
  }
}

export function pickSchoolText(text: SchoolLangText, lang: UiLanguage): string {
  if (lang === 'en') return text.en
  if (lang === 'sc') return text.sc
  return text.tc
}

export function getSchoolEtaDestination(
  entry: Pick<KmbEtaEntryWithLeg, 'dest_en' | 'dest_tc' | 'dest_sc'>,
  lang: UiLanguage
): string {
  if (lang === 'en') return (entry.dest_en ?? '').trim() || (entry.dest_tc ?? '').trim()
  if (lang === 'sc')
    return (
      (entry.dest_sc ?? '').trim() || (entry.dest_tc ?? '').trim() || (entry.dest_en ?? '').trim()
    )
  return (entry.dest_tc ?? '').trim() || (entry.dest_en ?? '').trim()
}

export function schoolEtaTimeMs(entry: Pick<KmbEtaEntryWithLeg, 'eta'>): number {
  if (!entry.eta) return Number.POSITIVE_INFINITY
  const parsed = Date.parse(entry.eta)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

export type SchoolDestinationGroup = {
  destination: string
  soonestMs: number
  departures: Array<{
    entry: KmbEtaEntryWithLeg
    stopId: string
    location: SchoolLangText
    subgroup: SchoolLangText
  }>
}

const SCHOOL_DESTINATION_FALLBACK: SchoolLangText = {
  en: 'Unknown destination',
  tc: '未知目的地',
  sc: '未知目的地',
}

export function groupSchoolEtasByDestination(
  byStopId: Record<string, KmbEtaEntryWithLeg[]>,
  lang: UiLanguage
): SchoolDestinationGroup[] {
  const byDestination = new Map<string, SchoolDestinationGroup>()
  for (const [stopId, entries] of Object.entries(byStopId)) {
    const where = SCHOOL_STOP_LOCATION.get(stopId) ?? {
      locationId: 'other',
      location: { en: stopId, tc: stopId, sc: stopId },
      subgroup: { en: '', tc: '', sc: '' },
    }
    for (const entry of entries) {
      const destination =
        getSchoolEtaDestination(entry, lang) || pickSchoolText(SCHOOL_DESTINATION_FALLBACK, lang)
      const group = byDestination.get(destination)
      const row = { entry, stopId, location: where.location, subgroup: where.subgroup }
      if (group) {
        group.departures.push(row)
      } else {
        byDestination.set(destination, {
          destination,
          soonestMs: schoolEtaTimeMs(entry),
          departures: [row],
        })
      }
    }
  }
  const groups = Array.from(byDestination.values())
  for (const group of groups) {
    group.departures.sort(
      (a, b) =>
        schoolEtaTimeMs(a.entry) - schoolEtaTimeMs(b.entry) || a.entry.eta_seq - b.entry.eta_seq
    )
    group.soonestMs = group.departures.length
      ? schoolEtaTimeMs(group.departures[0].entry)
      : Number.POSITIVE_INFINITY
  }
  groups.sort((a, b) => {
    if (a.soonestMs !== b.soonestMs) return a.soonestMs - b.soonestMs
    return a.destination.localeCompare(b.destination)
  })
  return groups
}
