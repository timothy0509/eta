"use client";

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
import type { LrtStationSearchItem, UiLanguage } from "@/lib/eta/types";
import { cn } from "@/lib/utils";
import * as React from "react";
import Fuse from "fuse.js";
import { Search, TramFront } from "lucide-react";

type Props = {
  lang: UiLanguage;
  stations: LrtStationSearchItem[];
  selectedStationId?: string;
  onSelect: (station: LrtStationSearchItem) => void;
};

function formatStationName(station: LrtStationSearchItem, lang: UiLanguage) {
  if (lang === "en") return station.nameEn;
  return station.nameZh;
}

function formatStationSecondary(station: LrtStationSearchItem, lang: UiLanguage) {
  // Secondary label shows the "other" language; for English UI, always use Chinese (TC).
  if (lang === "en") return station.nameZh;
  return station.nameEn;
}

function isStationIdQuery(query: string) {
  // Station IDs are niche; show them only when user searches for them.
  return /^\d+$/.test(query.trim());
}

export function LrtStationSearch({
  lang,
  stations,
  selectedStationId,
  onSelect,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listId = React.useId();

  const trimmedQuery = query.trim();
  const showStationId = isStationIdQuery(trimmedQuery);

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.stationId, station]));
  }, [stations]);

  const selected = React.useMemo(() => {
    if (!selectedStationId) return undefined;
    return stationsById.get(selectedStationId);
  }, [selectedStationId, stationsById]);

  const fuse = React.useMemo(() => {
    return new Fuse(stations, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: "nameEn", weight: 0.55 },
        { name: "nameZh", weight: 0.45 },
      ],
    });
  }, [stations]);

  const results = React.useMemo(() => {
    if (!trimmedQuery) return [] as LrtStationSearchItem[];

    if (showStationId) {
      return stations
        .filter((s) => s.stationId.startsWith(trimmedQuery))
        .slice(0, 40);
    }

    const hits = fuse.search(trimmedQuery).slice(0, 40);
    return hits.map((h: { item: LrtStationSearchItem }) => h.item);
  }, [fuse, showStationId, stations, trimmedQuery]);

  const displayResults = trimmedQuery ? results : stations.slice(0, 12);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          className={cn(
            "w-full justify-start rounded-2xl border bg-card/70 text-left shadow-sm",
            "hover:bg-card",
            !selected && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          {selected ? formatStationName(selected, lang) : (
            lang === "en" ? "Search LRT stop…" : lang === "sc" ? "搜索轻铁站…" : "搜尋輕鐵站…"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={lang === "en" ? "Type a stop name…" : lang === "sc" ? "输入车站名称…" : "輸入車站名稱…"}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList id={listId}>
            <CommandEmpty>{lang === "en" ? "No results." : "無結果。"}</CommandEmpty>
            <CommandGroup heading={lang === "en" ? "Stops" : lang === "sc" ? "车站" : "車站"}>
              {displayResults.map((station: LrtStationSearchItem) => (
                <CommandItem
                  key={station.stationId}
                  value={station.stationId}
                  onSelect={() => {
                    onSelect(station);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border bg-background/50 p-2">
                    <TramFront className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {formatStationName(station, lang)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatStationSecondary(station, lang)}
                      {showStationId ? ` · ${station.stationId}` : null}
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
