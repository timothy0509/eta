import { fetchEtaDb } from 'hk-bus-eta'
import { buildEtaDbIndexes } from './lib/eta/eta-db-index'
import { buildRouteSearchIndex, searchRouteIndex } from './lib/eta/route-search'
import { listKmbRoutes, listKmbRouteStops } from './lib/eta/direct/eta-db'
const db = await fetchEtaDb()
await buildEtaDbIndexes(db, {
  busCompanies: ['kmb', 'ctb', 'nlb', 'nwfb', 'gmb', 'lrtfeeder', 'lightRail', 'mtr'] as never,
})
const routes = await listKmbRoutes()
const stops = await listKmbRouteStops()
console.log('routes n=', routes.length, 'routeStops n=', stops.length)
