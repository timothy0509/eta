import { describe, expect, it, vi, afterEach } from 'vitest'

import { checkMapTileArchiveHealth, MAP_TILE_ARCHIVE_URL, MAP_TILE_PROTOCOL } from './map-tiles'

function headResponse(status: number, headers: Record<string, string> = {}): Response {
  return new Response(null, { status, headers })
}

describe('map tile constants', () => {
  it('reads its source from the forked Pages deployment', () => {
    expect(MAP_TILE_ARCHIVE_URL).toBe(
      'https://timothy0509.github.io/hk-pmtiles-generation/hong-kong.pmtiles'
    )
    expect(MAP_TILE_PROTOCOL).toBe('pmtiles://')
  })
})

describe('checkMapTileArchiveHealth', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('accepts a recent archive', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          headResponse(200, { 'last-modified': new Date(Date.now() - 86_400_000).toUTCString() })
        )
    )
    expect(await checkMapTileArchiveHealth()).toEqual({ ok: true })
  })

  it('flags a 404 as missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(headResponse(404)))
    const result = await checkMapTileArchiveHealth()
    expect(result).toEqual({ ok: false, reason: 'missing' })
  })

  it('flags an archive older than two weeks as stale with its age', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        headResponse(200, {
          'last-modified': new Date(Date.now() - 20 * 86_400_000).toUTCString(),
        })
      )
    )
    const result = await checkMapTileArchiveHealth()
    expect(result).toMatchObject({ ok: false, reason: 'stale', ageDays: 20 })
  })

  it('does not fail the check on unreachable networks', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    const result = await checkMapTileArchiveHealth()
    expect(result).toEqual({ ok: true })
  })
})
