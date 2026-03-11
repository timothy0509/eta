/**
 * Shared utilities for grouping KMB stops by stop code
 */

import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";

export type StopGroup = {
  id: string;
  baseName: string;
  codes: string[];
  stops: KmbStopSearchItem[];
  displayName: string;
  displayCodes: string;
  displaySecondary: string;
};

export type StopComputed = {
  stopId: string;
  baseName: string;
  stopCode: string | null;
  displayName: string;
  displaySecondary: string;
  searchName: string;
  searchSecondary: string;
  searchCode: string;
  normalized: string;
  stop: KmbStopSearchItem;
};

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage): string {
  if (lang === "sc") return stop.nameSc;
  if (lang === "en") return stop.nameEn;
  return stop.nameTc;
}

function formatStopSecondary(stop: KmbStopSearchItem, lang: UiLanguage): string {
  if (lang === "en") return stop.nameTc;
  return stop.nameEn;
}

/**
 * Parse a stop code into prefix and numeric parts.
 * e.g., "KT313" → { prefix: "KT", num: 313 }
 */
export function parseCodeParts(code: string): { prefix: string; num: number } | null {
  const match = code.match(/^([A-Z]{1,2})(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], num: parseInt(match[2], 10) };
}

/**
 * Check if a set of codes are sequential (same prefix, consecutive numbers).
 */
export function areCodesSequential(codes: string[]): boolean {
  if (codes.length <= 1) return true;
  const parsed = codes.map(parseCodeParts).filter(Boolean) as { prefix: string; num: number }[];
  if (parsed.length !== codes.length) return false;

  const prefix = parsed[0].prefix;
  if (!parsed.every((p) => p.prefix === prefix)) return false;

  const nums = parsed.map((p) => p.num).sort((a, b) => a - b);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Format a range of sequential codes.
 * e.g., ["KT313", "KT314", "KT315", "KT316"] → "KT313-KT316"
 */
export function formatCodeRange(codes: string[]): string {
  if (codes.length === 0) return "";
  if (codes.length === 1) return codes[0];

  const sorted = [...codes].sort((a, b) => {
    const pa = parseCodeParts(a);
    const pb = parseCodeParts(b);
    if (!pa || !pb) return a.localeCompare(b);
    return pa.num - pb.num;
  });

  return `${sorted[0]}-${sorted[sorted.length - 1]}`;
}

/**
 * Build StopComputed for a stop - precomputes fields needed for grouping and display.
 */
export function buildStopComputed(stop: KmbStopSearchItem, lang: UiLanguage): StopComputed {
  const fullName = formatStopName(stop, lang);
  const parsed = parseKmbStopName(fullName);
  const baseName = parsed.name;
  const stopCode = parsed.stopCode;
  const displayName = baseName;
  const displaySecondary = formatStopSecondary(stop, lang);

  const searchName = displayName.toLowerCase().trim();
  const searchSecondary = displaySecondary.toLowerCase().trim();
  const searchCode = (stopCode ?? "").toLowerCase().trim();

  const normalized = `${stop.nameEn}|${stop.nameTc}|${stop.nameSc}|${baseName}|${stopCode ?? ""}`
    .toLowerCase()
    .trim();

  return {
    stopId: stop.stopId,
    baseName,
    stopCode,
    displaySecondary,
    displayName,
    searchName,
    searchSecondary,
    searchCode,
    normalized,
    stop,
  };
}

/**
 * Group stops by their base name (without code) and merge those with sequential codes.
 * Handles multiple separate sequential sets (e.g., KT313-KT316 AND KT681-KT683).
 * Non-sequential stops remain as individual items.
 */
export function groupStopsByName(stops: StopComputed[]): StopGroup[] {
  const byBaseName = new Map<string, StopComputed[]>();
  for (const stop of stops) {
    const baseName = stop.baseName;
    if (!byBaseName.has(baseName)) {
      byBaseName.set(baseName, []);
    }
    byBaseName.get(baseName)!.push(stop);
  }

  const result: StopGroup[] = [];

  for (const [baseName, items] of byBaseName) {
    const withCodes = items.filter((i) => i.stopCode !== null);
    const withoutCodes = items.filter((i) => i.stopCode === null);

    withCodes.sort((a, b) => {
      const pa = parseCodeParts(a.stopCode!);
      const pb = parseCodeParts(b.stopCode!);
      if (!pa || !pb) return 0;
      if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
      return pa.num - pb.num;
    });

    const runs: StopComputed[][] = [];
    for (const item of withCodes) {
      const lastRun = runs[runs.length - 1];
      if (!lastRun) {
        runs.push([item]);
        continue;
      }

      const lastItem = lastRun[lastRun.length - 1];
      const lastParts = parseCodeParts(lastItem.stopCode!);
      const currParts = parseCodeParts(item.stopCode!);

      if (
        lastParts &&
        currParts &&
        lastParts.prefix === currParts.prefix &&
        currParts.num === lastParts.num + 1
      ) {
        lastRun.push(item);
      } else {
        runs.push([item]);
      }
    }

    for (const run of runs) {
      if (run.length >= 2) {
        const codes = run.map((r) => r.stopCode!).filter(Boolean);
        const runStops = run.map((r) => r.stop);
        result.push({
          id: `group:${runStops.map((s) => s.stopId).join(",")}`,
          baseName,
          codes,
          stops: runStops,
          displayName: baseName,
          displayCodes: `(${formatCodeRange(codes)})`,
          displaySecondary: run[0]?.displaySecondary ?? "",
        });
      } else {
        const item = run[0];
        result.push({
          id: `stop:${item.stop.stopId}`,
          baseName,
          codes: item.stopCode ? [item.stopCode] : [],
          stops: [item.stop],
          displayName: baseName,
          displayCodes: item.stopCode ? `(${item.stopCode})` : "",
          displaySecondary: item.displaySecondary,
        });
      }
    }

    for (const item of withoutCodes) {
      result.push({
        id: `stop:${item.stop.stopId}`,
        baseName,
        codes: [],
        stops: [item.stop],
        displayName: baseName,
        displayCodes: "",
        displaySecondary: item.displaySecondary,
      });
    }
  }

  return result;
}
