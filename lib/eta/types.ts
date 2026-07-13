export type TransportMode = 'kmb' | 'mtr' | 'lrt'

export type UiLanguage = 'en' | 'tc' | 'sc'

export type SubView = 'routes' | 'stops' | 'nearby' | 'saved' | 'settings'

export function isLanguageSupported(mode: TransportMode, lang: UiLanguage) {
  if (lang === 'sc') {
    return mode === 'kmb'
  }
  return true
}

/**
 * Returns the default UI language for a transport mode.
 * Currently all modes default to Traditional Chinese (tc) as it provides
 * the best coverage for Hong Kong transit information.
 */
export function defaultLanguageForMode(): UiLanguage {
  return 'tc'
}

export type KmbStopSearchItem = {
  stopId: string
  nameEn: string
  nameTc: string
  nameSc: string
  lat: number
  lng: number
}

export type LrtStationSearchItem = {
  stationId: string
  nameEn: string
  nameZh: string
}

export type MtrStationSearchItem = {
  labelId: string // stable id for merged stations
  sta: string // used for API requests
  lines: string[] // all lines serving this station
  nameEn: string
  nameTc: string
}

// MTR System Map types for schematic map component
export type MapBranch = {
  id?: string
  from?: string
  sequence?: string[]
  branches?: MapBranch[]
  notes?: string
}

export type MapLine = {
  id: string
  name: string
  color: string
  loop?: boolean
  stations?: string[]
  trunk?: string[]
  branches?: MapBranch[]
}

export type LineSequence = {
  key: string
  id: string
  name: string
  color: string
  stations: string[]
}
