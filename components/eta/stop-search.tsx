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
  | { type: "contains"; query: string };

type Props = {
  lang: UiLanguage;
  stops: KmbStopSearchItem[];
  value?: StopSearchSelection;
  onSelectStop: (stop: KmbStopSearchItem) => void;
  onSelectContains: (query: string) => void;
};

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "sc") return stop.nameSc;
  if (lang === "en") return stop.nameEn;
  return stop.nameTc;
}

function formatStopSecondary(stop: KmbStopSearchItem, lang: UiLanguage) {
  // KMB stop IDs are API-internal and should never be shown.
  // Secondary label shows the "other" language; for English UI, always use TC.
  if (lang === "en") return stop.nameTc;
  return stop.nameEn;
}

export function StopSearch({ lang, stops, value, onSelectStop, onSelectContains }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  // Defer the search query to keep input responsive during typing
  const deferredQuery = React.useDeferredValue(query);
  const isSearching = query !== deferredQuery;

  const selectedStop = React.useMemo(() => {
    if (!value) return undefined;
    if (value.type !== "stop") return undefined;
    return stops.find((s) => s.stopId === value.stopId);
  }, [stops, value]);

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

  const results = React.useMemo(() => {
    if (!deferredQuery.trim()) return [] as KmbStopSearchItem[];
    const hits = fuse.search(deferredQuery.trim()).slice(0, 40);
    return hits.map((h) => h.item);
  }, [fuse, deferredQuery]);

  const trimmedQuery = query.trim();
  const canSearchContains = trimmedQuery.length >= 3;

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
            !selectedStop && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          {selectedStop
            ? formatStopName(selectedStop, lang)
            : value?.type === "contains"
              ? `Contains: ${value.query}`
              : "Search stop name…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a stop name…"
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
                  Type 3+ characters for “contains” search.
                </div>
              ) : null}

              {(results.length ? results : stops.slice(0, 12)).map((stop) => (
                <CommandItem
                  key={stop.stopId}
                  value={stop.stopId}
                  onSelect={() => {
                    onSelectStop(stop);
                    setOpen(false);
                  }}

                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border bg-background/50 p-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {formatStopName(stop, lang)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatStopSecondary(stop, lang)}
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
