#!/usr/bin/env node
/**
 * Downloads the Hong Kong vector tile archive into public/map/ so the app
 * serves it from its own origin. Third-party tile hosts get blocked or drop
 * range requests on some mobile networks; same-origin sidesteps all of it.
 *
 * Runs as a prebuild/predev step:
 * - skips when the archive already exists (set FORCE_MAP_TILE_FETCH=1 to
 *   force a re-download for fresh tiles)
 * - verifies the PMTiles magic bytes before writing
 * - source host comes from env MAP_TILE_FETCH_URL so a different archive
 *   mirror needs no code change
 */
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, statSync } from 'node:fs'
import { rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_SOURCE = 'https://timothy0509.github.io/hk-pmtiles-generation/hong-kong.pmtiles'
const SOURCE_URL = process.env.MAP_TILE_FETCH_URL || DEFAULT_SOURCE
const OUT_PATH = join(
  resolve(dirname(fileURLToPath(import.meta.url)), '..'),
  'public',
  'map',
  'hong-kong.pmtiles'
)
const PREDOWNLOAD_MIN_BYTES = 1_000_000

function log(msg) {
  console.log(`[fetch-map-tiles] ${msg}`)
}

async function isUpToDateAndValid() {
  if (!existsSync(OUT_PATH)) return false
  const size = statSync(OUT_PATH).size
  if (size < PREDOWNLOAD_MIN_BYTES) return false
  const handle = await import('node:fs').then((fs) => fs.promises.open(OUT_PATH, 'r'))
  try {
    const { buffer } = await handle.read(Buffer.alloc(8), 0, 8, 0)
    return buffer.toString('ascii', 0, 7) === 'PMTiles'
  } finally {
    await handle.close()
  }
}

async function main() {
  const force = process.env.FORCE_MAP_TILE_FETCH === '1'
  if (!force && (await isUpToDateAndValid())) {
    log('archive already present and valid, skipping')
    return
  }
  log(`downloading ${SOURCE_URL}`)
  let bytes = null
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(SOURCE_URL, { cache: 'no-store' })
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
      bytes = Buffer.from(await response.arrayBuffer())
      break
    } catch (err) {
      console.error(`[fetch-map-tiles] attempt ${attempt} failed: ${err}`)
      bytes = null
    }
  }
  if (
    !bytes ||
    bytes.length < PREDOWNLOAD_MIN_BYTES ||
    bytes.toString('ascii', 0, 7) !== 'PMTiles'
  ) {
    // Never fail the build: a missing archive degrades to a tile-less map
    // and this warning is loud rather than hidden.
    console.error(
      '[fetch-map-tiles] giving up: the map will lack tiles. Check network reachability of the tile archive host.'
    )
    process.exit(0)
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true })
  const tempPath = `${OUT_PATH}.tmp`
  await writeFile(tempPath, bytes)
  await rename(tempPath, OUT_PATH)
  const sha = createHash('sha256').update(bytes).digest('hex').slice(0, 12)
  log(`wrote ${OUT_PATH} (${(bytes.length / 1_048_576).toFixed(1)} MiB, sha256 ${sha})`)
}

main().catch((err) => {
  console.error('[fetch-map-tiles] failed:', err)
  process.exit(0)
})
