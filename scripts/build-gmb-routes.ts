/**
 * Build the compact GMB route directory served at /data/gmb-routes.json plus
 * the per-variant stop table served at /data/gmb-stops.json.
 *
 * The TD source file is ~20 MB of per-stop GeoJSON with route fields
 * repeated on every stop, far too heavy for mobile clients. This script
 * compacts it to one entry per route id (~375 KB) plus the stop table, plus
 * the dataset revision date. Re-run after each biweekly TD update:
 *
 *   bun run data:gmb
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  GMB_DATASET_URL,
  GMB_GEOJSON_URL,
  GMB_UPDATE_DATE_URL,
  extractGmbRoutes,
  extractGmbStops,
  parseGmbCutoffDate,
} from '../lib/eta/gmb'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_ROUTES_PATH = join(ROOT, 'public', 'data', 'gmb-routes.json')
const OUT_STOPS_PATH = join(ROOT, 'public', 'data', 'gmb-stops.json')

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`)
  const text = await response.text()
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

async function main(): Promise<void> {
  const [geojsonText, csvText] = await Promise.all([
    fetchText(GMB_GEOJSON_URL),
    fetchText(GMB_UPDATE_DATE_URL),
  ])
  const parsed: unknown = JSON.parse(geojsonText)
  const routes = extractGmbRoutes(parsed)
  const stops = extractGmbStops(parsed)
  const cutoffDate = parseGmbCutoffDate(csvText)
  if (!cutoffDate) throw new Error('Could not read the TD revision cut-off date')
  if (routes.length === 0) throw new Error('Extract produced no GMB routes')
  if (stops.length === 0) throw new Error('Extract produced no GMB stops')

  const generatedAt = new Date().toISOString()
  const routesFile = {
    meta: {
      source: GMB_GEOJSON_URL,
      dataset: GMB_DATASET_URL,
      cutoffDate,
      generatedAt,
      count: routes.length,
    },
    routes,
  }
  const stopsFile = {
    meta: {
      source: GMB_GEOJSON_URL,
      dataset: GMB_DATASET_URL,
      cutoffDate,
      generatedAt,
      count: stops.length,
    },
    routes: stops,
  }
  await mkdir(dirname(OUT_ROUTES_PATH), { recursive: true })
  await writeFile(OUT_ROUTES_PATH, `${JSON.stringify(routesFile)}`, 'utf8')
  await writeFile(OUT_STOPS_PATH, `${JSON.stringify(stopsFile)}`, 'utf8')
  console.log(`Wrote ${routes.length} GMB routes (cutoff ${cutoffDate}) to ${OUT_ROUTES_PATH}`)
  console.log(`Wrote ${stops.length} GMB stop routes (cutoff ${cutoffDate}) to ${OUT_STOPS_PATH}`)
}

await main()
