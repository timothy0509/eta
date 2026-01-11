"use client";

import * as React from "react";
import Fuse from "fuse.js";
import { MapPin, Search } from "lucide-react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { createParseKmbStopNameCached } from "@/lib/eta/kmb-stop-name";
import { cn } from "@/lib/utils";

export type StopSearchSelection =
  | { type: "stop"; stopId: string }
  | { type: "stops"; stopIds: string[] }
  | { type: "contains"; query: string };

type Props = {
  lang: UiLanguage;
  stops: KmbStopSearchItem[];
  stopById?: Map<string, KmbStopSearchItem>;
  value?: StopSearchSelection;
  onSelectStop: (stop: KmbStopSearchItem) => void;
  onSelectStops: (stops: KmbStopSearchItem[]) => void;
  onSelectContains: (query: string) => void;
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
  stopIds: string[];
  displayName: string;
  displayCodes: string;
  displaySecondary: string;
};

type StopMeta = {
  baseName: string;
  stopCode: string | null;
  secondaryLabel: string;
};

/**
 * Group stops by their base name (without code) and merge those with sequential codes.
 * Handles multiple separate sequential sets (e.g., KT313-KT316 AND KT681-KT683).
 * Non-sequential stops remain as individual items.
 */
function createStopMetaIndex(stops: KmbStopSearchItem[], lang: UiLanguage) {
  const parseCached = createParseKmbStopNameCached();

  const stopMetaById = new Map<string, StopMeta>();
  const stopIdsByBaseName = new Map<string, string[]>();

  for (const stop of stops) {
    const fullName = formatStopName(stop, lang);
    const parsed = parseCached(fullName);

    const meta: StopMeta = {
      baseName: parsed.name,
      stopCode: parsed.stopCode,
      secondaryLabel: formatStopSecondary(stop, lang),
    };

    stopMetaById.set(stop.stopId, meta);

    const list = stopIdsByBaseName.get(meta.baseName);
    if (list) {
      list.push(stop.stopId);
    } else {
      stopIdsByBaseName.set(meta.baseName, [stop.stopId]);
    }
  }

  return { parseCached, stopMetaById, stopIdsByBaseName };
}

function buildGroupsByBaseName(
  stopIdsByBaseName: Map<string, string[]>,
  stopMetaById: Map<string, StopMeta>
) {
  const groupsByBaseName = new Map<string, StopGroup[]>();

  for (const [baseName, stopIds] of stopIdsByBaseName) {
    const items = stopIds.map((stopId) => ({ stopId, meta: stopMetaById.get(stopId)! }));

    const withCodes = items.filter((i) => i.meta.stopCode !== null);
    const withoutCodes = items.filter((i) => i.meta.stopCode === null);

    withCodes.sort((a, b) => {
      const pa = parseCodeParts(a.meta.stopCode!);
      const pb = parseCodeParts(b.meta.stopCode!);
      if (!pa || !pb) return 0;
      if (pa.prefix !== pb.prefix) return pa.prefix.localeCompare(pb.prefix);
      return pa.num - pb.num;
    });

    const runs: { stopId: string; meta: StopMeta }[][] = [];
    for (const item of withCodes) {
      const lastRun = runs[runs.length - 1];
      if (!lastRun) {
        runs.push([item]);
        continue;
      }

      const lastItem = lastRun[lastRun.length - 1];
      const lastParts = parseCodeParts(lastItem.meta.stopCode!);
      const currParts = parseCodeParts(item.meta.stopCode!);

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

    const groups: StopGroup[] = [];

    for (const run of runs) {
      if (run.length >= 2) {
        const codes = run.map((r) => r.meta.stopCode!).filter(Boolean);
        const stopIdsForRun = run.map((r) => r.stopId);

        groups.push({
          id: `group:${stopIdsForRun.join(",")}`,
          baseName,
          codes,
          stopIds: stopIdsForRun,
          displayName: baseName,
          displayCodes: `(${formatCodeRange(codes)})`,
          displaySecondary: run[0].meta.secondaryLabel,
        });
      } else {
        const item = run[0];
        groups.push({
          id: `stop:${item.stopId}`,
          baseName,
          codes: [item.meta.stopCode!],
          stopIds: [item.stopId],
          displayName: baseName,
          displayCodes: `(${item.meta.stopCode})`,
          displaySecondary: item.meta.secondaryLabel,
        });
      }
    }

    for (const item of withoutCodes) {
      groups.push({
        id: `stop:${item.stopId}`,
        baseName,
        codes: [],
        stopIds: [item.stopId],
        displayName: baseName,
        displayCodes: "",
        displaySecondary: item.meta.secondaryLabel,
      });
    }

    groupsByBaseName.set(baseName, groups);
  }

  return groupsByBaseName;
}

export function StopSearch({
  lang,
  stops,
  stopById: stopByIdProp,
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

  const stopById = React.useMemo(() => {
    if (stopByIdProp) return stopByIdProp;
    return new Map(stops.map((s) => [s.stopId, s] as const));
  }, [stopByIdProp, stops]);

  const { parseCached, stopMetaById, stopIdsByBaseName } = React.useMemo(
    () => createStopMetaIndex(stops, lang),
    [stops, lang]
  );

  const groupsByBaseName = React.useMemo(
    () => buildGroupsByBaseName(stopIdsByBaseName, stopMetaById),
    [stopIdsByBaseName, stopMetaById]
  );

  // Find selected stop(s) for display in the button
  const selectedLabel = React.useMemo(() => {
    if (!value) return null;

    if (value.type === "stop") {
      const stop = stopById.get(value.stopId);
      if (!stop) return null;

      const fullName = formatStopName(stop, lang);
      const parsed = parseCached(fullName);
      return parsed.stopCode ? `${parsed.name} (${parsed.stopCode})` : parsed.name;
    }

    if (value.type === "stops") {
      const baseName = stopMetaById.get(value.stopIds[0])?.baseName;
      if (!baseName) return null;

      const codes: string[] = [];
      for (const stopId of value.stopIds) {
        const code = stopMetaById.get(stopId)?.stopCode;
        if (code) codes.push(code);
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
  }, [value, stopById, stopMetaById, lang, parseCached]);


  // Use Fuse.js to search individual stops, then group results
  const fuse = React.useMemo(() => {
    return new Fuse(stops, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: "nameEn", weight: 0.35 },
        { name: "nameTc", weight: 0.45 },
        { name: "nameSc", weight: 0.2 },
      ],
    });
  }, [stops]);

  // Search and group results
  const groupedResults = React.useMemo(() => {
    if (!deferredQuery.trim()) {
      // Default: show first 12 stops, grouped
      const baseNames = new Set<string>();
      const groups: StopGroup[] = [];

      for (const stop of stops.slice(0, 30)) {
        const baseName = stopMetaById.get(stop.stopId)?.baseName;
        if (!baseName || baseNames.has(baseName)) continue;

        const groupsForName = groupsByBaseName.get(baseName);
        if (!groupsForName) continue;

        baseNames.add(baseName);
        groups.push(...groupsForName);
        if (groups.length >= 12) break;
      }

      return groups.slice(0, 12);
    }

    const hits = fuse.search(deferredQuery.trim()).slice(0, 60);

    const baseNames = new Set<string>();
    const groups: StopGroup[] = [];

    for (const hit of hits) {
      const stopId = hit.item.stopId;
      const baseName = stopMetaById.get(stopId)?.baseName;
      if (!baseName || baseNames.has(baseName)) continue;

      const groupsForName = groupsByBaseName.get(baseName);
      if (!groupsForName) continue;

      baseNames.add(baseName);
      groups.push(...groupsForName);
      if (groups.length >= 20) break;
    }

    return groups.slice(0, 20);
  }, [fuse, deferredQuery, stops, stopMetaById, groupsByBaseName]);

  const trimmedQuery = query.trim();
  const canSearchContains = trimmedQuery.length >= 3;

  const handleSelectGroup = (group: StopGroup) => {
    const selectedStops = group.stopIds
      .map((stopId) => stopById.get(stopId))
      .filter(Boolean) as KmbStopSearchItem[];

    if (selectedStops.length === 1) {
      onSelectStop(selectedStops[0]);
    } else {
      onSelectStops(selectedStops);
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
            {selectedLabel || (lang === "en" ? "Search stop name..." : lang === "sc" ? "搜索车站..." : "搜尋車站...")}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={lang === "en" ? "Type a stop name..." : lang === "sc" ? "输入车站名称..." : "輸入車站名稱..."}
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
                      {(lang === "en" ? "Contains: " : lang === "sc" ? "包含: " : "包含: ") + trimmedQuery}
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
