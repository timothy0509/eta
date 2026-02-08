"use client";

import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { RouteBadge } from "@/components/eta/route-badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Marquee } from "@/components/ui/marquee";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { UiLanguage } from "@/lib/eta/types";
import { cn } from "@/lib/utils";
import type { RouteFilterMode } from "@/lib/store";

export type RouteFilterEntry = {
  id: string;
  variantKey: string;
};

export type RouteFilterState = {
  routes?: string;
  entries?: RouteFilterEntry[];
};

export type RouteFilterOption = {
  key: string; // `${co}|${route}|${direction}|${serviceType}`
  route: string;
  label: string;
};

type Props = {
  lang: UiLanguage;
  mode: RouteFilterMode;
  onModeChange: (mode: RouteFilterMode) => void;
  value: RouteFilterState;
  onChange: (value: RouteFilterState) => void;
  options?: RouteFilterOption[];
};

function normalizeAdvancedEntries(entries: RouteFilterEntry[] | undefined) {
  const list = entries ?? [];
  const seen = new Set<string>();
  const next: RouteFilterEntry[] = [];
  for (const entry of list) {
    if (!entry.variantKey) continue;
    const parts = entry.variantKey.split("|");
    const normalizedKey = parts.length === 3 ? `kmb|${entry.variantKey}` : entry.variantKey;
    if (seen.has(normalizedKey)) continue;
    seen.add(normalizedKey);
    next.push({ ...entry, variantKey: normalizedKey });
  }
  return next;
}

function sortOptions(options: RouteFilterOption[]) {
  return [...options].sort((a, b) =>
    a.route.localeCompare(b.route, undefined, { numeric: true })
  );
}

function findOption(options: RouteFilterOption[] | undefined, key: string) {
  return options?.find((opt) => opt.key === key);
}

export function RouteFilter({ lang, mode, onModeChange, value, onChange, options }: Props) {
  const opts = React.useMemo(() => sortOptions(options ?? []), [options]);
  const entries = React.useMemo(
    () => normalizeAdvancedEntries(value.entries),
    [value.entries]
  );

  const t = {
    routes: lang === "en" ? "Routes" : "路線",
    routesDesc:
      lang === "en"
        ? "Optional. Leave blank to show all routes at the stop."
        : lang === "sc"
          ? "可选。留空以显示车站的所有路线。"
          : "可選。留空以顯示車站的所有路線。",
    advanced: lang === "en" ? "Advanced" : lang === "sc" ? "高级" : "進階",
    routeNumbers:
      lang === "en"
        ? "Route numbers (comma-separated)"
        : lang === "sc"
          ? "路线编号（逗号分隔）"
          : "路線編號（逗號分隔）",
    eg: "e.g. 40, 68X",
    add: lang === "en" ? "Add" : "新增",
    pickStop: lang === "en" ? "Pick a stop first." : lang === "sc" ? "请先选择车站。" : "請先選擇車站。",
    noFilter:
      lang === "en"
        ? "No filter added. All routes at the stop will be shown."
        : lang === "sc"
          ? "未添加篩選，將顯示車站的所有路線。"
          : "未添加篩選，將顯示車站的所有路線。",
    selectRoute: lang === "en" ? "Select route…" : lang === "sc" ? "选择路线…" : "選擇路線…",
    searchRoute: lang === "en" ? "Search route…" : lang === "sc" ? "搜索路线…" : "搜尋路線…",
    noResults: lang === "en" ? "No results." : "無結果。",
  };

  return (
    <div className="rounded-2xl border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-medium">{t.routes}</div>
          <div className="text-xs text-muted-foreground">{t.routesDesc}</div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={mode === "advanced"}
            onCheckedChange={(checked) => onModeChange(checked ? "advanced" : "simple")}
            id="routeMode"
          />
          <Label htmlFor="routeMode" className="text-sm">
            {t.advanced}
          </Label>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="grid grid-cols-1 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">{t.routeNumbers}</Label>
          <Input
            value={value.routes ?? ""}
            onChange={(e) => onChange({ ...value, routes: e.target.value })}
            placeholder={t.eg}
            className="mt-1 rounded-xl"
            disabled={mode === "advanced"}
          />
        </div>

        {mode === "advanced" ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">{t.routes}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 shrink-0 rounded-xl"
                onClick={() => {
                  if (!opts.length) return;
                  const firstKey = opts[0]?.key;
                  if (!firstKey) return;

                  const next: RouteFilterEntry[] = [
                    ...entries,
                    {
                      id: crypto.randomUUID(),
                      variantKey: firstKey,
                    },
                  ];
                  onChange({ ...value, entries: next, routes: "" });
                }}
                disabled={!opts.length}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t.add}
              </Button>
            </div>

            {!opts.length ? (
              <div className="rounded-xl border bg-background/40 p-3 text-xs text-muted-foreground">
                {t.pickStop}
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border bg-background/40 p-3 text-xs text-muted-foreground">
                {t.noFilter}
              </div>
            ) : null}

            {entries.map((entry) => {
              const selected = findOption(opts, entry.variantKey);

              return (
                <div key={entry.id} className="flex min-w-0 items-center gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-9 min-w-0 flex-1 justify-between rounded-xl",
                          !selected && "text-muted-foreground"
                        )}
                      >
                        {selected ? (
                          <div className="flex min-w-0 flex-1 items-center gap-2">
                            <RouteBadge route={selected.route} size="md" />
                            <Marquee className="min-w-0 flex-1 text-left text-muted-foreground">
                              {selected.label}
                            </Marquee>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{t.selectRoute}</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
                      <Command shouldFilter>
                        <CommandInput placeholder={t.searchRoute} />
                        <CommandList>
                          <CommandEmpty>{t.noResults}</CommandEmpty>
                          <CommandGroup>
                            {opts.map((opt) => {
                              const picked = opt.key === entry.variantKey;
                              return (
                                <CommandItem
                                  key={opt.key}
                                  value={`${opt.route} ${opt.label}`}
                                  onSelect={() => {
                                    const next = entries.map((row) =>
                                      row.id === entry.id ? { ...row, variantKey: opt.key } : row
                                    );
                                    onChange({
                                      ...value,
                                      entries: normalizeAdvancedEntries(next),
                                      routes: "",
                                    });
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      picked ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <RouteBadge route={opt.route} size="sm" />
                                  <span className="ml-2 min-w-0 truncate text-muted-foreground">
                                    {opt.label}
                                  </span>
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  <Button
                    type="button"
                    size="icon-sm"
                    variant="outline"
                    className="shrink-0 rounded-xl"
                    onClick={() => {
                      const next = entries.filter((row) => row.id !== entry.id);
                      onChange({ ...value, entries: next });
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
