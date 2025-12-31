#!/usr/bin/env node

/**
 * Extract fare source data from Transport Department MDB files.
 *
 * This generates the input expected by `scripts/build-kmb-fares.mjs`:
 *   data/fare/kmb-fare-source.v1.json
 *
 * It uses `mdb-export` (mdbtools) and expects the MDB to contain at least:
 *   - ROUTE
 *   - RSTOP
 *   - FARE
 *
 * Note: The `ROUTE_BUS.mdb` committed in this repo currently only contains ROUTE,
 * which is not sufficient to compute stop-to-stop fares.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_ROUTE_MDB = path.join(ROOT, "ROUTE_BUS.mdb");
const DEFAULT_RSTOP_MDB = path.join(ROOT, "RSTOP_BUS.mdb");
const DEFAULT_FARE_MDB = path.join(ROOT, "FARE_BUS.mdb");
const OUTPUT = path.join(ROOT, "data", "fare", "kmb-fare-source.v1.json");

function fatal(message) {
  console.error(message);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  });

  if (result.error) {
    fatal(`Failed to run ${command}: ${String(result.error)}`);
  }
  if (result.status !== 0) {
    fatal(`Command failed (${command} ${args.join(" ")}):\n${result.stderr || result.stdout}`);
  }

  return result.stdout;
}

function parseCsvLine(line) {
  // Minimal CSV parser compatible with mdb-export output.
  // - Commas separate fields.
  // - Double quotes may wrap fields.
  // - Double quotes inside quoted fields are escaped as "".
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        const next = line[i + 1];
        if (next === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }

    if (ch === ',') {
      result.push(current);
      current = "";
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    current += ch;
  }

  result.push(current);
  return result;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const header = parseCsvLine(lines[0]);
  const rows = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    /** @type {Record<string, string>} */
    const row = {};
    for (let i = 0; i < header.length; i++) {
      row[header[i]] = values[i] ?? "";
    }
    rows.push(row);
  }

  return rows;
}

function ensureTableExists(mdbPath, table) {
  const tables = run("mdb-tables", ["-1", mdbPath])
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (!tables.includes(table)) {
    fatal(
      `MDB ${path.relative(ROOT, mdbPath)} is missing table ${table}.\n` +
        `Available tables: ${tables.join(", ") || "(none)"}`
    );
  }
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return null;
  return process.argv[idx + 1] ?? null;
}

const routeMdb = getArg("--route-mdb") ?? getArg("--mdb") ?? DEFAULT_ROUTE_MDB;
const rstopMdb = getArg("--rstop-mdb") ?? getArg("--mdb") ?? DEFAULT_RSTOP_MDB;
const fareMdb = getArg("--fare-mdb") ?? getArg("--mdb") ?? DEFAULT_FARE_MDB;

for (const [label, fp] of [
  ["ROUTE", routeMdb],
  ["RSTOP", rstopMdb],
  ["FARE", fareMdb],
]) {
  if (!fs.existsSync(fp)) {
    fatal(`${label} MDB file not found: ${fp}`);
  }
}

ensureTableExists(routeMdb, "ROUTE");
ensureTableExists(rstopMdb, "RSTOP");
ensureTableExists(fareMdb, "FARE");

const routesCsv = run("mdb-export", [routeMdb, "ROUTE"]);
const rstopCsv = run("mdb-export", [rstopMdb, "RSTOP"]);
const fareCsv = run("mdb-export", [fareMdb, "FARE"]);

const routesRaw = parseCsv(routesCsv);
const rstopRaw = parseCsv(rstopCsv);
const fareRaw = parseCsv(fareCsv);

const routes = routesRaw
  .filter((r) => {
    const code = String(r.COMPANY_CODE ?? "").toUpperCase();
    // Include KMB, LWB, and joint operations involving them
    return code.includes("KMB") || code.includes("LWB");
  })
  .map((r) => ({
    routeId: Number(r.ROUTE_ID),
    // The ROUTE table doesn't carry ROUTE_SEQ; we include both sequences as potential candidates.
    routeSeq: 1,
    routeName: String(r.ROUTE_NAMEE ?? r.ROUTE_NAMES ?? r.ROUTE_NAMEC ?? "").trim(),
    companyCode: r.COMPANY_CODE ?? null,
  }))
  .filter((r) => Number.isFinite(r.routeId) && r.routeName);

// Expand to routeSeq=2 candidates too, so indexing can match inbound.
const routesExpanded = [
  ...routes,
  ...routes.map((r) => ({ ...r, routeSeq: 2 })),
];

const routeStops = rstopRaw
  .map((rs) => ({
    routeId: Number(rs.ROUTE_ID),
    routeSeq: Number(rs.ROUTE_SEQ),
    stopSeq: Number(rs.STOP_SEQ),
    stopId: rs.STOP_ID === "" ? undefined : Number(rs.STOP_ID),
    stopNameEn: String(rs.STOP_NAMEE ?? "").trim(),
    stopNameTc: String(rs.STOP_NAMEC ?? "").trim(),
    stopNameSc: String(rs.STOP_NAMES ?? "").trim(),
  }))
  .filter((rs) => Number.isFinite(rs.routeId) && (rs.routeSeq === 1 || rs.routeSeq === 2) && Number.isFinite(rs.stopSeq));

const fares = fareRaw
  .map((f) => ({
    routeId: Number(f.ROUTE_ID),
    routeSeq: Number(f.ROUTE_SEQ),
    // Bus files don't include DAY_CODE; keep 511 (All Days) so index can apply priority logic.
    dayCode: 511,
    onSeq: Number(f.ON_SEQ),
    offSeq: Number(f.OFF_SEQ),
    price: Number(f.PRICE),
  }))
  .filter(
    (f) =>
      Number.isFinite(f.routeId) &&
      (f.routeSeq === 1 || f.routeSeq === 2) &&
      Number.isFinite(f.dayCode) &&
      Number.isFinite(f.onSeq) &&
      Number.isFinite(f.offSeq) &&
      Number.isFinite(f.price)
  );

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(
  OUTPUT,
  JSON.stringify(
    {
      routes: routesExpanded,
      routeStops,
      fares,
    },
    null,
    2
  )
);

console.log(`Wrote ${path.relative(ROOT, OUTPUT)}`);
console.log(`routes: ${routesExpanded.length}, routeStops: ${routeStops.length}, fares: ${fares.length}`);
