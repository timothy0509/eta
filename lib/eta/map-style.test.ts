import { describe, expect, it } from 'vitest'

import { basemapLabelLangForUi, buildBaseMapStyle, overlayPalette } from './map-style'

describe('basemapLabelLangForUi', () => {
  it('maps the UI languages onto Protomaps label languages', () => {
    expect(basemapLabelLangForUi('en')).toBe('en')
    expect(basemapLabelLangForUi('tc')).toBe('zh-Hant')
    expect(basemapLabelLangForUi('sc')).toBe('zh-Hans')
  })
})

describe('buildBaseMapStyle', () => {
  const style = buildBaseMapStyle('light', 'en')

  it('points the vector source at our PMTiles archive with attribution', () => {
    expect(style.version).toBe(8)
    const tiles = style.sources?.tiles
    if (!tiles || tiles.type !== 'vector') throw new Error('missing vector tile source')
    expect(tiles.url).toMatch(/^pmtiles:\/\/.*hong-kong\.pmtiles$/)
    expect('attribution' in tiles && String(tiles.attribution).includes('OpenStreetMap')).toBe(true)
  })

  it('wires glyphs and sprite endpoints for labels and icons', () => {
    expect(style.glyphs).toBe('https://fonts.protomaps.com/fonts/{fontstack}/{range}.pbf')
    expect(style.sprite).toBe('https://sprites.protomaps.com/sprites/sprite')
  })

  it('emits the protomaps basemap layers', () => {
    expect(style.layers.length).toBeGreaterThan(10)
    expect(style.layers.some((layer) => layer.id === 'background')).toBe(true)
    expect(style.layers.some((layer) => layer.id === 'roads_highway')).toBe(true)
    expect(style.layers.some((layer) => layer.id === 'water')).toBe(true)
  })

  it('differs between light and dark flavors', () => {
    const dark = buildBaseMapStyle('dark', 'en')
    expect(JSON.stringify(dark)).not.toBe(JSON.stringify(style))
  })

  it('labels switch language with the UI language', () => {
    const sc = buildBaseMapStyle('light', 'zh-Hans')
    expect(JSON.stringify(sc)).not.toBe(JSON.stringify(style))
  })
})

describe('overlayPalette', () => {
  it('has light and dark variants', () => {
    expect(JSON.stringify(overlayPalette('light'))).not.toBe(overlayPalette('dark'))
    expect(overlayPalette('light').routeCasing).toMatch(/^#/)
    expect(overlayPalette('dark').userFill).toMatch(/^#/)
  })
})
