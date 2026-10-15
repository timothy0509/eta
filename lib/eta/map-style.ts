import { DARK, LIGHT, layers } from '@protomaps/basemaps'
import type { StyleSpecification } from 'maplibre-gl'

import {
  MAP_ATTRIBUTION_HTML,
  MAP_GLYPHS_URL,
  MAP_SPRITE_URL,
  MAP_TILE_ARCHIVE_URL,
  MAP_TILE_PROTOCOL,
} from '@/lib/eta/direct/map-tiles'
import type { UiLanguage } from '@/lib/eta/types'

export type MapTheme = 'light' | 'dark'

/**
 * Protomaps basemap label languages supported by the tile schema and the
 * @protomaps/basemaps style builder. Our UI language set maps cleanly.
 */
export type MapLabelLanguage = 'en' | 'zh-Hant' | 'zh-Hans'

export function basemapLabelLangForUi(lang: UiLanguage): MapLabelLanguage {
  if (lang === 'tc') return 'zh-Hant'
  if (lang === 'sc') return 'zh-Hans'
  return 'en'
}

/**
 * Builds the full vector basemap style for the map. Layers come from
 * @protomaps/basemaps (BSD-3-Clause) driven over our self-generated Hong Kong
 * PMTiles archive; light/dark are palette flavors of the same layers, so a
 * theme swap is just a new style object.
 */
export function buildBaseMapStyle(theme: MapTheme, lang: MapLabelLanguage): StyleSpecification {
  return {
    version: 8,
    glyphs: MAP_GLYPHS_URL,
    sprite: MAP_SPRITE_URL,
    sources: {
      tiles: {
        type: 'vector',
        url: `${MAP_TILE_PROTOCOL}${MAP_TILE_ARCHIVE_URL}`,
        attribution: MAP_ATTRIBUTION_HTML,
      },
    },
    layers: layers('tiles', theme === 'dark' ? DARK : LIGHT, { lang }),
  }
}

// Overlay palette for our own data layers (route line, stops, user dot).
// Kept here so the map component stays presentational.

export type OverlayPalette = {
  routeCasing: string
  routeMain: string
  stopFill: string
  stopStroke: string
  stopSelectedFill: string
  stopSelectedStroke: string
  stopLabelHalo: string
  stopLabelText: string
  userFill: string
  userAccuracy: string
}

const LIGHT_PALETTE: OverlayPalette = {
  routeCasing: '#14202e',
  routeMain: '#0b57d0',
  stopFill: '#0b57d0',
  stopStroke: '#ffffff',
  stopSelectedFill: '#f5a742',
  stopSelectedStroke: '#14202e',
  stopLabelHalo: '#14202e',
  stopLabelText: '#ffffff',
  userFill: '#005db6',
  userAccuracy: 'rgba(9, 84, 169, 0.14)',
}

const DARK_PALETTE: OverlayPalette = {
  routeCasing: '#000000',
  routeMain: '#7cb0ff',
  stopFill: '#7cb0ff',
  stopStroke: '#16181d',
  stopSelectedFill: '#f5a742',
  stopSelectedStroke: '#000000',
  stopLabelHalo: '#0d0f13',
  stopLabelText: '#ffffff',
  userFill: '#a8c7fa',
  userAccuracy: 'rgba(75, 134, 253, 0.16)',
}

export function overlayPalette(theme: MapTheme): OverlayPalette {
  return theme === 'dark' ? DARK_PALETTE : LIGHT_PALETTE
}
