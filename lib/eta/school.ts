import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import { groupEtasByVariant, type EtaGroup } from '@/lib/eta/kmb-eta-groups'

/** Bilingual copy shared by the standalone school page. */
export type SchoolText = {
  en: string
  tc: string
  sc: string
}

export type SchoolStopGroup = {
  id: string
  label: SchoolText
  stopIds: string[]
}

export type SchoolLocation = {
  id: string
  name: SchoolText
  groups: SchoolStopGroup[]
}

/**
 * The hand-picked stops behind /school. KMB ids are hex strings; Citybus
 * ids are the numeric stop codes. The page intentionally fetches these
 * exact ids instead of relying on a search or the saved-state store.
 */
export const SCHOOL_LOCATIONS: SchoolLocation[] = [
  {
    id: 'pak-hung-house',
    name: {
      en: 'Pak Hung House, Choi Wan Estate',
      tc: '彩雲邨白虹樓',
      sc: '彩云邨白虹楼',
    },
    groups: [
      {
        id: 'eastbound',
        label: { en: 'Eastbound', tc: '東行', sc: '东行' },
        stopIds: ['29740CCBBD82FC33', '942E95B4336BDFA7', '9A16E73DC0B9AF6C'],
      },
      {
        id: 'westbound',
        label: { en: 'Westbound', tc: '西行', sc: '西行' },
        stopIds: ['3BA9C90738A8600D', '58611212645F0AB1'],
      },
      {
        id: 'citybus-westbound',
        label: { en: 'Citybus westbound', tc: '城巴西行', sc: '城巴西行' },
        stopIds: ['001779'],
      },
      {
        id: 'citybus-eastbound',
        label: { en: 'Citybus eastbound', tc: '城巴東行', sc: '城巴东行' },
        stopIds: ['001652'],
      },
    ],
  },
  {
    id: 'kai-yip-estate',
    name: { en: 'Kai Yip Estate', tc: '啟業邨', sc: '启业邨' },
    groups: [
      {
        id: 'eastbound',
        label: { en: 'Eastbound', tc: '東行', sc: '东行' },
        stopIds: [
          '23AF5995FEBCA8E6',
          'BA03816A38B9DA7F',
          'D9B53E4B3A192940',
          'F60097D67F33DC0C',
          '001504',
        ],
      },
    ],
  },
  {
    id: 'choi-hing-court',
    name: { en: 'Choi Hing Court', tc: '彩興苑', sc: '彩兴苑' },
    groups: [
      {
        id: 'stop',
        label: { en: 'Bus stop', tc: '巴士站', sc: '巴士站' },
        stopIds: ['53FCF9B3DFD6C9F2'],
      },
    ],
  },
  {
    id: 'choi-wan-bus-terminus',
    name: { en: 'Choi Wan Bus Terminus', tc: '彩雲總站', sc: '彩云总站' },
    groups: [
      {
        id: 'terminus',
        label: { en: 'Bus terminus', tc: '巴士總站', sc: '巴士总站' },
        stopIds: ['09680C5849BFA077', '177A516A81E9DEA5', '6D1FFB57C26F1108'],
      },
      {
        id: 'choi-wan-estate',
        label: { en: 'Choi Wan Estate', tc: '彩雲邨', sc: '彩云邨' },
        stopIds: ['1EF5FAB9266BD6C8'],
      },
    ],
  },
]

export const SCHOOL_STOP_IDS = Array.from(
  new Set(SCHOOL_LOCATIONS.flatMap((location) => location.groups.flatMap((group) => group.stopIds)))
)

export const SCHOOL_DEPARTURE_LIMIT = 3

export type SchoolEtaEntry = {
  stopId: string
  location: SchoolLocation
  group: SchoolStopGroup
  entry: KmbEtaEntryWithLeg
}

export type SchoolRouteRow = EtaGroup & {
  route: string
  company: string
  destination: SchoolText
}

export type SchoolStopSection = {
  locationId: string
  locationName: SchoolText
  groupId: string
  groupLabel: SchoolText
  routes: SchoolRouteRow[]
}

export type SchoolDestinationRow = SchoolRouteRow & {
  locationId: string
  locationName: SchoolText
  groupId: string
  groupLabel: SchoolText
}

export type SchoolDestinationSection = {
  key: string
  destination: SchoolText
  rows: SchoolDestinationRow[]
}

function etaTime(eta: string): number {
  const parsed = Date.parse(eta)
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed
}

function compareRoutes(a: { route: string }, b: { route: string }): number {
  return a.route.localeCompare(b.route, undefined, { numeric: true })
}

function destinationOf(entry: KmbEtaEntryWithLeg | undefined): SchoolText {
  return {
    en: entry?.dest_en ?? '',
    tc: entry?.dest_tc ?? '',
    sc: entry?.dest_sc ?? '',
  }
}

function destinationKey(destination: SchoolText): string {
  return (destination.tc || destination.en || destination.sc).trim()
}

/**
 * Flatten the per-stop API response into config order, dropping entries
 * without a usable arrival time and ids the config does not know about.
 */
export function collectSchoolEtas(
  byStopId: Record<string, KmbEtaEntryWithLeg[]>,
  locations: SchoolLocation[] = SCHOOL_LOCATIONS
): SchoolEtaEntry[] {
  const entries: SchoolEtaEntry[] = []
  for (const location of locations) {
    for (const group of location.groups) {
      for (const stopId of group.stopIds) {
        for (const entry of byStopId[stopId] ?? []) {
          if (!entry.eta) continue
          if (Number.isNaN(Date.parse(entry.eta))) continue
          entries.push({ stopId, location, group, entry })
        }
      }
    }
  }
  return entries
}

/** The first few real departures from an existing ETA group. */
export function schoolDepartures(
  items: KmbEtaEntryWithLeg[],
  limit = SCHOOL_DEPARTURE_LIMIT
): KmbEtaEntryWithLeg[] {
  return items.filter((entry) => entry.eta && !Number.isNaN(Date.parse(entry.eta))).slice(0, limit)
}

function buildRouteRows(entries: SchoolEtaEntry[]): SchoolRouteRow[] {
  // Reuse the app's existing variant grouping so joint operators, leg
  // suffixes, fare keys and route ordering all behave exactly like the
  // normal results view. Only the display destination is added here.
  return groupEtasByVariant(
    entries.map((entry) => entry.entry),
    {}
  )
    .filter((group) => group.hasEta)
    .map((group) => {
      const first = group.items[0]
      return {
        ...group,
        route: String(first?.route ?? ''),
        company: String(first?.groupCo ?? first?.co ?? 'kmb'),
        destination: destinationOf(first),
      }
    })
}

export function groupSchoolEtasByStop(entries: SchoolEtaEntry[]): SchoolStopSection[] {
  const entriesByGroup = new Map<string, SchoolEtaEntry[]>()
  for (const entry of entries) {
    const key = `${entry.location.id}|${entry.group.id}`
    const list = entriesByGroup.get(key)
    if (list) {
      list.push(entry)
    } else {
      entriesByGroup.set(key, [entry])
    }
  }

  return SCHOOL_LOCATIONS.flatMap((location) =>
    location.groups.map((group) => ({
      locationId: location.id,
      locationName: location.name,
      groupId: group.id,
      groupLabel: group.label,
      routes: buildRouteRows(entriesByGroup.get(`${location.id}|${group.id}`) ?? []),
    }))
  )
}

export function groupSchoolEtasByDestination(
  entries: SchoolEtaEntry[]
): SchoolDestinationSection[] {
  const sections = new Map<string, SchoolDestinationSection>()

  for (const section of groupSchoolEtasByStop(entries)) {
    for (const row of section.routes) {
      const key = destinationKey(row.destination)
      let destinationSection = sections.get(key)
      if (!destinationSection) {
        destinationSection = {
          key,
          destination: row.destination,
          rows: [],
        }
        sections.set(key, destinationSection)
      }
      destinationSection.rows.push({
        ...row,
        key: `${row.key}|${section.locationId}|${section.groupId}`,
        locationId: section.locationId,
        locationName: section.locationName,
        groupId: section.groupId,
        groupLabel: section.groupLabel,
      })
    }
  }

  const result = Array.from(sections.values())
  for (const section of result) {
    section.rows.sort((a, b) => sortByNextDeparture(a, b) || compareRoutes(a, b))
  }
  result.sort((a, b) => sortByNextDeparture(a.rows[0], b.rows[0]))
  return result
}

function nextDepartureTime(row: SchoolRouteRow | undefined): number {
  const first = row ? schoolDepartures(row.items, 1)[0] : undefined
  return first ? etaTime(first.eta) : Number.POSITIVE_INFINITY
}

function sortByNextDeparture(a: SchoolRouteRow | undefined, b: SchoolRouteRow | undefined): number {
  return nextDepartureTime(a) - nextDepartureTime(b)
}
