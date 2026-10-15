/**
 * Registers the `pmtiles://` protocol on the shared maplibre runtime.
 * The registration happens once per page load; the underlying Protocol
 * instance keeps an archive byte cache keyed by URL, so repeated mounts of
 * the map component reuse already-fetched archive ranges.
 */
let registration: Promise<void> | null = null

export async function registerMapPmtilesProtocol(): Promise<void> {
  if (!registration) {
    registration = (async () => {
      const [maplibre, pmtiles] = await Promise.all([import('maplibre-gl'), import('pmtiles')])
      const protocol = new pmtiles.Protocol({ errorOnMissingTile: false })
      maplibre.addProtocol('pmtiles', (params, abortController) =>
        protocol.tile(params, abortController)
      )
    })().catch((err: unknown) => {
      registration = null
      throw err
    })
  }
  return registration
}
