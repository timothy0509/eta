/**
 * Build the compact GMB route directory served at /data/gmb-routes.json.
 *
 * The TD source file is ~20 MB of per-stop GeoJSON with route fields
 * repeated on every stop, far too heavy for mobile clients. This script
 * compacts it to one entry per route id (~375 KB) plus the dataset
 * revision date. Re-run after each biweekly TD update:
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
  parseGmbCutoffDate,
} from '../lib/eta/gmb'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_PATH = join(ROOT, 'public', 'data', 'gmb-routes.json')

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
  const routes = extractGmbRoutes(JSON.parse(geojsonText) as unknown)
  const cutoffDate = parseGmbCutoffDate(csvText)
  if (!cutoffDate) throw new Error('Could not read the TD revision cut-off date')
  if (routes.length === 0) throw new Error('Extract produced no GMB routes')

  const file = {
    meta: {
      source: GMB_GEOJSON_URL,
      dataset: GMB_DATASET_URL,
      cutoffDate,
      generatedAt: new Date().toISOString(),
      count: routes.length,
    },
    routes,
  }
  await mkdir(dirname(OUT_PATH), { recursive: true })
  await writeFile(OUT_PATH, `${JSON.stringify(file)}`, 'utf8')
  console.log(`Wrote ${routes.length} GMB routes (cutoff ${cutoffDate}) to ${OUT_PATH}`)
}

await main()
