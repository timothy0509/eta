import { fetchEtaDb } from 'hk-bus-eta'
import { buildEtaDbIndexes } from './lib/eta/eta-db-index'
import { buildRouteSearchIndex, searchRouteIndex } from './lib/eta/route-search'
import { getEtaDbIndexes, listKmbRoutes, listKmbRouteStops } from './lib/eta/direct/eta-db'
const db = await fetchEtaDb()
await buildEtaDbIndexes(db, {
  busCompanies: ['kmb', 'ctb', 'nlb', 'nwfb', 'gmb', 'lrtfeeder', 'lightRail', 'mtr'] as never,
})
// prime caches not needed; call via indexes directly
import { getEtaDbIndexes as g } from './lib/eta/direct/eta-db'
