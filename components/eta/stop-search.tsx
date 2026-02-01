"use client";

import { MapPin, Search } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { cn } from "@/lib/utils";
import Fuse from "fuse.js";

export type StopSearchSelection =
  | { type: "stop"; stopId: string }
  | { type: "stops"; stopIds: string[] }
  | { type: "contains"; query: string };

type Props = {
  lang: UiLanguage;
  stops: KmbStopSearchItem[];
  value?: StopSearchSelection;
  onSelectStop: (stop: KmbStopSearchItem) => void;
  onSelectStops: (stops: KmbStopSearchItem[]) => void;
  onSelectContains: (query: string) => void;
};

type StopComputed = {
  stopId: string;
  baseName: string;
  stopCode: string | null;
  displaySecondary: string;

  /** Primary display name in selected UI language */
  displayName: string;

  /** Search fields with better weighting */
  searchName: string;
  searchSecondary: string;
  searchCode: string;

  /** Catch-all fallback for fuzzy matches */
  normalized: string;

  stop: KmbStopSearchItem;
};

// --- Utility functions for stop name/code parsing ---

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "sc") return stop.nameSc;
  if (lang === "en") return stop.nameEn;
  return stop.nameTc;
}

function formatStopSecondary(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameTc;
  return stop.nameEn;
}


/**
 * Parse a stop code into prefix and numeric parts.
 * e.g., "KT313" → { prefix: "KT", num: 313 }
 */
function parseCodeParts(code: string): { prefix: string; num: number } | null {
  const match = code.match(/^([A-Z]{1,2})(\d+)$/);
  if (!match) return null;
  return { prefix: match[1], num: parseInt(match[2], 10) };
}

/**
 * Check if a set of codes are sequential (same prefix, consecutive numbers).
 */
function areCodesSequential(codes: string[]): boolean {
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
function formatCodeRange(codes: string[]): string {
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

// --- Stop grouping types and logic ---

type StopGroup = {
  id: string; // Unique key for React
  baseName: string;
  codes: string[];
  stops: KmbStopSearchItem[];
  displayName: string;
  displayCodes: string;
  displaySecondary: string;
};

/**
 * Group stops by their base name (without code) and merge those with sequential codes.
 * Handles multiple separate sequential sets (e.g., KT313-KT316 AND KT681-KT683).
 * Non-sequential stops remain as individual items.
 */
function groupStopsByName(stops: StopComputed[]): StopGroup[] {
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

export function StopSearch({
  lang,
  stops,
  value,
  onSelectStop,
  onSelectStops,
  onSelectContains,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Defer the search query to keep input responsive during typing
  const deferredQuery = React.useDeferredValue(query);
  const isSearching = query !== deferredQuery;

  // Find selected stop(s) for display in the button
  const selectedLabel = React.useMemo(() => {
    if (!value) return null;
    if (value.type === "stop") {
      const stop = stops.find((s) => s.stopId === value.stopId);
      if (stop) {
        const fullName = formatStopName(stop, lang);
        const parsed = parseKmbStopName(fullName);
        return parsed.stopCode ? `${parsed.name} (${parsed.stopCode})` : parsed.name;
      }
      return null;
    }
    if (value.type === "stops") {
      // Find first stop to get base name
      const firstStop = stops.find((s) => value.stopIds.includes(s.stopId));
      if (!firstStop) return null;

      const fullName = formatStopName(firstStop, lang);
      const { name: baseName } = parseKmbStopName(fullName);

      // Collect all codes for selected stops
      const codes: string[] = [];
      for (const stopId of value.stopIds) {
        const stop = stops.find((s) => s.stopId === stopId);
        if (stop) {
          const parsed = parseKmbStopName(formatStopName(stop, lang));
          if (parsed.stopCode) codes.push(parsed.stopCode);
        }
      }

      if (codes.length > 1 && areCodesSequential(codes)) {
        return `${baseName} (${formatCodeRange(codes)})`;
      }
      return baseName;
    }
    if (value.type === "contains") {
      return (lang === "en" ? "Contains: " : lang === "sc" ? "包含: " : "包含: ") + value.query;
    }
    return null;
  }, [value, stops, lang]);


  const stopComputed = React.useMemo<StopComputed[]>(() => {
    return stops.map((stop) => {
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
    });
  }, [stops, lang]);

  const fuse = React.useMemo(() => {
    return new Fuse(stopComputed, {
      // Lower threshold = stricter matching = higher precision.
      // We also explicitly boost exact/prefix matches in post-processing.
      threshold: 0.28,
      ignoreLocation: true,
      minMatchCharLength: 2,
      includeScore: true,
      shouldSort: true,
      keys: [
        { name: "searchCode", weight: 0.55 },
        { name: "searchName", weight: 0.30 },
        { name: "searchSecondary", weight: 0.10 },
        { name: "normalized", weight: 0.05 },
      ],
    });
  }, [stopComputed]);

  // Search and group results
  const groupedResults = React.useMemo(() => {
    if (!deferredQuery.trim()) {
      // Default: show first 12 stops, grouped
      return groupStopsByName(stopComputed.slice(0, 30)).slice(0, 12);
    }

    const needle = deferredQuery.trim().toLowerCase();

    const hits = fuse.search(needle).slice(0, 80);

    // Prefer exact/prefix matches (stop code or name) over generic fuzzy score.
    // This improves accuracy for common user behavior:
    // - typing stop code prefixes (KT31…)
    // - typing station name prefixes
    const scored = hits
      .map((h: { item: StopComputed; score?: number }) => {
        const item = h.item;

        const exact =
          (item.searchCode && item.searchCode === needle) ||
          item.searchName === needle ||
          item.searchSecondary === needle;

        const prefix =
          (item.searchCode && item.searchCode.startsWith(needle)) ||
          item.searchName.startsWith(needle) ||
          item.searchSecondary.startsWith(needle);

        const includes =
          (item.searchCode && item.searchCode.includes(needle)) ||
          item.searchName.includes(needle) ||
          item.searchSecondary.includes(needle);

        // Fuse score is lower-is-better; normalize missing to a mediocre score.
        const fuseScore = h.score ?? 0.5;

        const boost = exact ? 0 : prefix ? 1 : includes ? 2 : 3;
        return { item, fuseScore, boost };
      })
      .sort((a, b) => {
        if (a.boost !== b.boost) return a.boost - b.boost;
        return a.fuseScore - b.fuseScore;
      })
      .slice(0, 60);

    return groupStopsByName(scored.map((s) => s.item)).slice(0, 20);
  }, [fuse, deferredQuery, stopComputed]);

  const trimmedQuery = query.trim();
  const canSearchContains = trimmedQuery.length >= 3;

  const handleSelectGroup = (group: StopGroup) => {
    if (group.stops.length === 1) {
      onSelectStop(group.stops[0]);
    } else {
      onSelectStops(group.stops);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full min-w-0 justify-start rounded-2xl border bg-card/70 text-left shadow-sm",
            "hover:bg-card",
            !selectedLabel && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">
            {selectedLabel || (lang === "en" ? "Search stop name..." : lang === "sc" ? "搜尋車站…" : "搜尋車站…")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={lang === "en" ? "Type a stop name…" : lang === "sc" ? "輸入車站名稱…" : "輸入車站名稱…"}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className={cn(isSearching && "opacity-60 transition-opacity")}>
            <CommandEmpty>{lang === "en" ? "No results." : "無結果。"}</CommandEmpty>
            <CommandGroup heading={lang === "en" ? "Stops" : lang === "sc" ? "车站" : "車站"}>
              {canSearchContains ? (
                <CommandItem
                  key={`contains:${trimmedQuery}`}
                  value={`contains:${trimmedQuery}`}
                  onSelect={() => {
                    onSelectContains(trimmedQuery);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border bg-background/50 p-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {(lang === "en" ? "Contains: " : lang === "sc" ? "包含：" : "包含：") + trimmedQuery}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {lang === "en"
                        ? "Search all stops whose name contains this text"
                        : lang === "sc"
                          ? "搜索所有名称包含此文本的车站"
                          : "搜尋所有名稱包含此文本的車站"}
                    </div>
                  </div>
                </CommandItem>
              ) : trimmedQuery.length ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Type 3+ characters for \"contains\" search."
                    : lang === "sc"
                      ? "输入 3 个以上字符以进行“包含”搜索。"
                      : "輸入 3 個以上字符以進行「包含」搜尋。"}
                </div>
              ) : null}


              {groupedResults.map((group) => (
                <CommandItem
                  key={group.id}
                  value={group.id}
                  onSelect={() => handleSelectGroup(group)}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border bg-background/50 p-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {group.displayName}{" "}
                      {group.displayCodes ? (
                        <span className="font-normal text-muted-foreground">
                          {group.displayCodes}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {group.displaySecondary}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
