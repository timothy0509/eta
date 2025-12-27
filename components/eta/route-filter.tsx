"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";

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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import type { RouteFilterMode } from "@/lib/store";
import { cn } from "@/lib/utils";

export type RouteFilterEntry = {
  id: string;
  variantKey: string;
};

export type RouteFilterState = {
  routes?: string;
  entries?: RouteFilterEntry[];
};

export type RouteFilterOption = {
  key: string; // `${route}|${direction}|${serviceType}`
  route: string;
  label: string;
};

type Props = {
  mode: RouteFilterMode;
  onModeChange: (mode: RouteFilterMode) => void;
  value: RouteFilterState;
  onChange: (value: RouteFilterState) => void;
  options?: RouteFilterOption[];
};

function normalizeRoutesText(raw: string) {
  const hasTrailingComma = raw.trimEnd().endsWith(",");

  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toUpperCase());

  const normalized = parts.join(", ");
  return hasTrailingComma ? `${normalized}, ` : normalized;
}

function normalizeAdvancedEntries(entries: RouteFilterEntry[] | undefined) {
  const list = entries ?? [];
  const seen = new Set<string>();
  const next: RouteFilterEntry[] = [];
  for (const entry of list) {
    if (!entry.variantKey) continue;
    if (seen.has(entry.variantKey)) continue;
    seen.add(entry.variantKey);
    next.push(entry);
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

export function RouteFilter({ mode, onModeChange, value, onChange, options }: Props) {
  const opts = React.useMemo(() => sortOptions(options ?? []), [options]);
  const entries = React.useMemo(
    () => normalizeAdvancedEntries(value.entries),
    [value.entries]
  );

  return (
    <div className="rounded-2xl border bg-card/50 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-medium">Routes</div>
          <div className="text-xs text-muted-foreground">
            Optional. Leave blank to show all routes at the stop.
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={mode === "advanced"}
            onCheckedChange={(checked) => onModeChange(checked ? "advanced" : "simple")}
            id="routeMode"
          />
          <Label htmlFor="routeMode" className="text-sm">
            Advanced
          </Label>
        </div>
      </div>

      <Separator className="my-3" />

       <div className="grid grid-cols-1 gap-3">
         <div>
           <Label className="text-xs text-muted-foreground">Route numbers (comma-separated)</Label>
            <Input
              value={value.routes ?? ""}
              onChange={(e) => onChange({ ...value, routes: normalizeRoutesText(e.target.value) })}
              onBlur={(e) => onChange({ ...value, routes: normalizeRoutesText(e.target.value) })}
              placeholder="e.g. 40, 68X"
              className="mt-1 rounded-xl"
              disabled={mode === "advanced"}
            />
         </div>

         {mode === "advanced" ? (
           <div className="space-y-2">
             <div className="flex items-center justify-between gap-2">
               <Label className="text-xs text-muted-foreground">Routes</Label>
               <Button
                 type="button"
                 size="sm"
                 variant="outline"
                 className="h-8 rounded-xl"
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
                 Add
               </Button>
             </div>

             {!opts.length ? (
               <div className="rounded-xl border bg-background/40 p-3 text-xs text-muted-foreground">
                 Pick a stop and press Search first.
               </div>
             ) : entries.length === 0 ? (
               <div className="rounded-xl border bg-background/40 p-3 text-xs text-muted-foreground">
                 Add one or more route variants.
               </div>
             ) : null}

             {entries.map((entry) => {
               const selected = findOption(opts, entry.variantKey);

               return (
                 <div key={entry.id} className="flex items-center gap-2">
                   <Popover>
                     <PopoverTrigger asChild>
                       <Button
                         type="button"
                         variant="outline"
                         className={cn(
                           "h-9 flex-1 justify-between rounded-xl",
                           !selected && "text-muted-foreground"
                         )}
                       >
                         <span className="truncate">
                           {selected ? `${selected.route} · ${selected.label}` : "Select route…"}
                         </span>
                         <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                       </Button>
                     </PopoverTrigger>
                     <PopoverContent className="w-[min(560px,calc(100vw-2rem))] p-0" align="start">
                       <Command shouldFilter>
                         <CommandInput placeholder="Search route…" />
                         <CommandList>
                           <CommandEmpty>No results.</CommandEmpty>
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
                                       "mr-2 h-4 w-4",
                                       picked ? "opacity-100" : "opacity-0"
                                     )}
                                   />
                                   <span className="truncate">{opt.route}</span>
                                   <span className="ml-2 truncate text-muted-foreground">
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
                     className="rounded-xl"
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
