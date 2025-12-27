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
import { cn } from "@/lib/utils";

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
 * Parse a KMB stop name to extract the code from parentheses.
 * e.g., "Chuk Yuen Estate Bus Terminus (WT916)" → { name: "Chuk Yuen Estate Bus Terminus", code: "WT916" }
 */
function parseStopNameAndCode(fullName: string): { name: string; code: string | null } {
  const match = fullName.match(/^(.+?)\s*\(([A-Z]{1,2}\d+)\)\s*$/);
  if (match) return { name: match[1].trim(), code: match[2] };
  return { name: fullName, code: null };
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
 * Group stops by their base name (without code) and only merge those with sequential codes.
 * Non-sequential stops remain as individual items.
 */
function groupStopsByName(stops: KmbStopSearchItem[], lang: UiLanguage): StopGroup[] {
  // First, parse all stops and group by base name
  const byBaseName = new Map<string, { codes: string[]; stops: KmbStopSearchItem[] }>();

  for (const stop of stops) {
    const fullName = formatStopName(stop, lang);
    const { name: baseName, code } = parseStopNameAndCode(fullName);

    if (!byBaseName.has(baseName)) {
      byBaseName.set(baseName, { codes: [], stops: [] });
    }
    const group = byBaseName.get(baseName)!;
    if (code) group.codes.push(code);
    group.stops.push(stop);
  }

  const result: StopGroup[] = [];

  for (const [baseName, { codes, stops: groupStops }] of byBaseName) {
    // Only group if all stops have codes and codes are sequential
    const allHaveCodes = codes.length === groupStops.length && codes.length > 0;

    if (allHaveCodes && codes.length > 1 && areCodesSequential(codes)) {
      // Merge into a single grouped suggestion
      result.push({
        id: `group:${groupStops.map((s) => s.stopId).join(",")}`,
        baseName,
        codes,
        stops: groupStops,
        displayName: baseName,
        displayCodes: `(${formatCodeRange(codes)})`,
        displaySecondary: formatStopSecondary(groupStops[0], lang),
      });
    } else {
      // Keep as individual stops
      for (const stop of groupStops) {
        const fullName = formatStopName(stop, lang);
        const { name, code } = parseStopNameAndCode(fullName);
        result.push({
          id: `stop:${stop.stopId}`,
          baseName: name,
          codes: code ? [code] : [],
          stops: [stop],
          displayName: name,
          displayCodes: code ? `(${code})` : "",
          displaySecondary: formatStopSecondary(stop, lang),
        });
      }
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
        const { name, code } = parseStopNameAndCode(fullName);
        return code ? `${name} (${code})` : name;
      }
      return null;
    }
    if (value.type === "stops") {
      // Find first stop to get base name
      const firstStop = stops.find((s) => value.stopIds.includes(s.stopId));
      if (!firstStop) return null;

      const fullName = formatStopName(firstStop, lang);
      const { name: baseName } = parseStopNameAndCode(fullName);

      // Collect all codes for selected stops
      const codes: string[] = [];
      for (const stopId of value.stopIds) {
        const stop = stops.find((s) => s.stopId === stopId);
        if (stop) {
          const { code } = parseStopNameAndCode(formatStopName(stop, lang));
          if (code) codes.push(code);
        }
      }

      if (codes.length > 1 && areCodesSequential(codes)) {
        return `${baseName} (${formatCodeRange(codes)})`;
      }
      return baseName;
    }
    if (value.type === "contains") {
      return `Contains: ${value.query}`;
    }
    return null;
  }, [value, stops, lang]);

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
      return groupStopsByName(stops.slice(0, 30), lang).slice(0, 12);
    }
    const hits = fuse.search(deferredQuery.trim()).slice(0, 60);
    const matchedStops = hits.map((h) => h.item);
    return groupStopsByName(matchedStops, lang).slice(0, 20);
  }, [fuse, deferredQuery, stops, lang]);

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
            "w-full justify-start rounded-2xl border bg-card/70 text-left shadow-sm",
            "hover:bg-card",
            !selectedLabel && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          {selectedLabel || "Search stop name..."}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a stop name..."
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className={cn(isSearching && "opacity-60 transition-opacity")}>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Stops">
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
                    <div className="truncate font-medium">Contains: {trimmedQuery}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      Search all stops whose name contains this text
                    </div>
                  </div>
                </CommandItem>
              ) : trimmedQuery.length ? (
                <div className="px-2 py-1 text-xs text-muted-foreground">
                  Type 3+ characters for "contains" search.
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
