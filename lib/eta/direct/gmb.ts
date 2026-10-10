import { CACHE_POLICIES } from '@/lib/eta/cache/policy'
import { GMB_ROUTES_CACHE_KEY } from '@/lib/eta/cache/keys'
import { getCachedValue } from '@/lib/eta/direct/shared'
import { parseGmbRouteListFile, type GmbRouteListFile } from '@/lib/eta/gmb'
import { fetchJson } from '@/lib/eta/http'

// Same-origin compact extract built by scripts/build-gmb-routes.ts. Served
// from public/, so no connect-src CSP addition is needed.
const GMB_ROUTES_URL = '/data/gmb-routes.json'

export type { GmbRouteListFile }

/** Load the compact GMB route directory, cached in memory plus IndexedDB. */
export async function fetchGmbRoutes(options?: {
  signal?: AbortSignal
}): Promise<GmbRouteListFile> {
  const { value } = await getCachedValue<GmbRouteListFile>({
    key: GMB_ROUTES_CACHE_KEY,
    policyKey: 'gmbStaticList',
    policy: CACHE_POLICIES.gmbStaticList,
    signal: options?.signal,
    fetcher: async () => {
      const raw: unknown = await fetchJson(GMB_ROUTES_URL, { signal: options?.signal })
      return parseGmbRouteListFile(raw)
    },
  })
  return value
}
