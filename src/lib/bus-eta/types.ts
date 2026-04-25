import type { Company, Eta, EtaDb, RouteListEntry, StopListEntry } from 'hk-bus-eta'

export type Language = 'en' | 'zh'

export type RouteSearchResult = {
  id: string
  route: string
  serviceType: string
  companies: Company[]
  origin: string
  destination: string
}

export type RouteStop = {
  seq: number
  stopId: string
  company: Company
  name: string
  location: StopListEntry['location']
}

export type EtaResult = {
  company: Eta['co']
  destination: string
  isoTime: string | null
  minutes: number | null
  remark: string
}

export type EtaDbState = {
  db: EtaDb
  md5: string
  fetchedAt: number
}

export type RouteRecord = {
  id: string
  entry: RouteListEntry
}
