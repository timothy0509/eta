"use client";

import { Search, TrainFront } from "lucide-react";
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
import type { MtrStationSearchItem, UiLanguage } from "@/lib/eta/types";
import { cn } from "@/lib/utils";
import Fuse from "fuse.js";

type Props = {
  lang: UiLanguage;
  stations: MtrStationSearchItem[];
  selectedSta?: string;
  onSelect: (station: MtrStationSearchItem) => void;
};

function formatStationName(station: MtrStationSearchItem, lang: UiLanguage) {
  if (lang === "tc") return station.nameTc;
  return station.nameEn;
}

function formatStationSecondary(station: MtrStationSearchItem, lang: UiLanguage) {
  // Secondary label shows the "other" language; for English UI, always use Chinese (TC).
  if (lang === "en") return station.nameTc;
  return station.nameEn;
}

function isStationCodeQuery(query: string) {
  return /^[A-Z]{3}$/i.test(query.trim());
}

export function MtrStationSearch({ lang, stations, selectedSta, onSelect }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const listId = React.useId();

  const trimmedQuery = query.trim();
  const showStationCode = isStationCodeQuery(trimmedQuery);

  const stationsById = React.useMemo(() => {
    return new Map(stations.map((station) => [station.sta, station]));
  }, [stations]);

  const selectedStation = React.useMemo(() => {
    if (!selectedSta) return undefined;
    return stationsById.get(selectedSta);
  }, [selectedSta, stationsById]);

  const fuse = React.useMemo(() => {
    return new Fuse(stations, {
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: "nameEn", weight: 0.55 },
        { name: "nameTc", weight: 0.45 },
      ],
    });
  }, [stations]);

  const results = React.useMemo(() => {
    if (!trimmedQuery) return [] as MtrStationSearchItem[];

    if (showStationCode) {
      return stations
        .filter((s) => s.sta.toUpperCase().startsWith(trimmedQuery.toUpperCase()))
        .slice(0, 40);
    }

    const hits = fuse.search(trimmedQuery).slice(0, 40);
    return hits.map((h: { item: MtrStationSearchItem }) => h.item);
  }, [fuse, showStationCode, stations, trimmedQuery]);

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
            !selectedStation && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          {selectedStation ? formatStationName(selectedStation, lang) : (
            lang === "en" ? "Search station name…" : lang === "sc" ? "搜索车站…" : "搜尋車站…"
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={lang === "en" ? "Type a station name…" : lang === "sc" ? "输入车站名称…" : "輸入車站名稱…"}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList id={listId}>
            <CommandEmpty>{lang === "en" ? "No results." : "無結果。"}</CommandEmpty>
            <CommandGroup heading={lang === "en" ? "Stations" : lang === "sc" ? "车站" : "車站"}>
              {displayResults.map((station: MtrStationSearchItem) => (
                <CommandItem
                  key={station.labelId}
                  value={station.labelId}
                  onSelect={() => {
                    onSelect(station);
                    setOpen(false);
                  }}
                  className="flex items-start gap-3"
                >
                  <div className="mt-0.5 rounded-lg border bg-background/50 p-2">
                    <TrainFront className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {formatStationName(station, lang)}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {formatStationSecondary(station, lang)}
                      {` · ${lang === "en" ? "Lines" : lang === "sc" ? "线路" : "路線"}: ${station.lines.join("/")}`}
                      {showStationCode ? ` · ${lang === "en" ? "Code" : lang === "sc" ? "代号" : "代號"}: ${station.sta}` : null}
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
