"use client";

import * as React from "react";
import Fuse from "fuse.js";
import { Search, TrainFront } from "lucide-react";

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
import type { MtrStationSearchItem, UiLanguage } from "@/lib/eta/types";
import { cn } from "@/lib/utils";

type Props = {
  lang: UiLanguage;
  stations: MtrStationSearchItem[];
  selected?: { line: string; sta: string };
  onSelect: (station: MtrStationSearchItem) => void;
};

function formatStationName(station: MtrStationSearchItem, lang: UiLanguage) {
  if (lang === "tc") return station.nameTc;
  return station.nameEn;
}

export function MtrStationSearch({ lang, stations, selected, onSelect }: Props) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedStation = React.useMemo(() => {
    if (!selected) return undefined;
    return stations.find((s) => s.line === selected.line && s.sta === selected.sta);
  }, [stations, selected]);

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
    if (!query.trim()) return [] as MtrStationSearchItem[];
    const hits = fuse.search(query.trim()).slice(0, 40);
    return hits.map((h) => h.item);
  }, [fuse, query]);

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
            !selectedStation && "text-muted-foreground"
          )}
        >
          <Search className="mr-2 h-4 w-4" />
          {selectedStation
            ? `${formatStationName(selectedStation, lang)} (${selectedStation.line}/${selectedStation.sta})`
            : "Search station name…"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Type a station name…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup heading="Stations">
              {(results.length ? results : stations.slice(0, 12)).map((station) => (
                <CommandItem
                  key={`${station.line}-${station.sta}`}
                  value={`${station.line}-${station.sta}`}
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
                      {station.nameEn} · {station.line}/{station.sta}
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
