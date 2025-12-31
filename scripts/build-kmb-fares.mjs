#!/usr/bin/env node

/**
 * Build a runtime-safe KMB fare index.
 *
 * Vercel/serverless runtime should not parse MDB files. This script is intended
 * to be run locally (or in a CI environment with MDB tooling) to generate
 * `data/fare/kmb-fare-index.v1.json`.
 *
 * Input format (JSON) is intentionally simple so you can generate it from MDB
 * using any external tool.
 *
 * Expected input file:
 *   data/fare/kmb-fare-source.v1.json
 *
 * Output file:
 *   data/fare/kmb-fare-index.v1.json
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const INPUT = path.join(ROOT, "data", "fare", "kmb-fare-source.v1.json");
const OUTPUT = path.join(ROOT, "data", "fare", "kmb-fare-index.v1.json");

function fatal(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(INPUT)) {
  fatal(
    `Missing input file: ${path.relative(ROOT, INPUT)}\n` +
      `Generate it from fare MDB/CSV exports then rerun: npm run fare:build`
  );
}

/**
 * @typedef {{ routeId: number, routeSeq: 1|2, routeName: string, companyCode?: string }} RouteRow
 * @typedef {{ routeId: number, routeSeq: 1|2, stopSeq: number, stopId?: number, stopNameEn?: string, stopNameTc?: string, stopNameSc?: string }} RouteStopRow
 * @typedef {{ routeId: number, routeSeq: 1|2, dayCode: number, onSeq: number, offSeq: number, price: number }} FareRow
 *
 * @typedef {{ routes: RouteRow[], routeStops: RouteStopRow[], fares: FareRow[] }} Source
 */

/** @type {Source} */
let source;
try {
  source = JSON.parse(fs.readFileSync(INPUT, "utf8"));
} catch (e) {
  fatal(`Failed to parse input JSON: ${String(e)}`);
}

if (!Array.isArray(source.routes) || !Array.isArray(source.routeStops) || !Array.isArray(source.fares)) {
  fatal("Input JSON must contain arrays: routes, routeStops, fares");
}

// Pick best fare by preferring DAY_CODE=511 (All Days).
const DAY_CODE_PRIORITY = [511, 480, 448, 447, 416, 415, 320, 319, 63, 31];
const dayRank = new Map(DAY_CODE_PRIORITY.map((code, idx) => [code, idx]));

/**
 * fareByKey: `${routeId}|${routeSeq}|${onSeq}|${offSeq}` -> { price, dayCode }
 */
const fareByKey = new Map();
for (const f of source.fares) {
  const routeId = Number(f.routeId);
  const routeSeq = Number(f.routeSeq);
  const onSeq = Number(f.onSeq);
  const offSeq = Number(f.offSeq);
  const price = Number(f.price);
  const dayCode = Number(f.dayCode);

  if (!Number.isFinite(routeId) || !Number.isFinite(routeSeq) || !Number.isFinite(onSeq) || !Number.isFinite(offSeq)) {
    continue;
  }
  if (!Number.isFinite(price)) continue;

  const key = `${routeId}|${routeSeq}|${onSeq}|${offSeq}`;
  const existing = fareByKey.get(key);
  if (!existing) {
    fareByKey.set(key, { price, dayCode });
    continue;
  }

  const existingRank = dayRank.get(existing.dayCode) ?? 9999;
  const nextRank = dayRank.get(dayCode) ?? 9999;
  if (nextRank < existingRank) {
    fareByKey.set(key, { price, dayCode });
  }
}

// Build stop names by (routeId|routeSeq|stopSeq) for matching.
const stopNameByKey = new Map();
for (const rs of source.routeStops) {
  const routeId = Number(rs.routeId);
  const routeSeq = Number(rs.routeSeq);
  const stopSeq = Number(rs.stopSeq);
  if (!Number.isFinite(routeId) || !Number.isFinite(routeSeq) || !Number.isFinite(stopSeq)) continue;

  const key = `${routeId}|${routeSeq}|${stopSeq}`;
  stopNameByKey.set(key, {
    en: (rs.stopNameEn ?? "").trim(),
    tc: (rs.stopNameTc ?? "").trim(),
    sc: (rs.stopNameSc ?? "").trim(),
  });
}

// routeName -> candidate route IDs
const routeCandidatesByName = new Map();
for (const r of source.routes) {
  const routeName = String(r.routeName ?? "").trim().toUpperCase();
  const routeId = Number(r.routeId);
  if (!routeName || !Number.isFinite(routeId)) continue;

  const list = routeCandidatesByName.get(routeName) ?? [];
  list.push({ routeId, companyCode: r.companyCode ?? null });
  routeCandidatesByName.set(routeName, list);
}

const index = {
  version: 1,
  generatedAt: new Date().toISOString(),
  dayCodePriority: DAY_CODE_PRIORITY,

  // Used to map `route` (e.g. "1A") to one or more route_id candidates.
  routeCandidatesByName: Object.fromEntries(routeCandidatesByName.entries()),

  // Used for comparing terminus names during matching.
  // Key: `${routeId}|${routeSeq}|${stopSeq}`
  stopNameByKey: Object.fromEntries(stopNameByKey.entries()),

  // Fare lookup
  // Key: `${routeId}|${routeSeq}|${onSeq}|${offSeq}` -> { price, dayCode }
  fareByKey: Object.fromEntries(fareByKey.entries()),
};

fs.writeFileSync(OUTPUT, JSON.stringify(index));
console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
