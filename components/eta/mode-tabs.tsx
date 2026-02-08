"use client";

import { Bus, TrainFront, TramFront } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TransportMode, UiLanguage } from "@/lib/eta/types";

const MODES: Array<{
  mode: TransportMode;
  labels: Record<UiLanguage, string>;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    mode: "kmb",
    labels: { en: "Bus", tc: "巴士", sc: "巴士" },
    icon: Bus,
  },
  {
    mode: "mtr",
    labels: { en: "MTR", tc: "港鐵", sc: "港铁" },
    icon: TrainFront,
  },
  {
    mode: "lrt",
    labels: { en: "Light Rail", tc: "輕鐵", sc: "轻铁" },
    icon: TramFront,
  },
];

type Props = {
  lang: UiLanguage;
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
};

export function ModeTabs({ lang, value, onChange }: Props) {
  return (
    <Tabs value={value} onValueChange={(nextValue) => onChange(nextValue as TransportMode)}>
      <TabsList
        withIndicator
        indicatorClassName="rounded-xl"
        className="grid w-full grid-cols-3 rounded-2xl"
      >
        {MODES.map((m) => {
          const Icon = m.icon;
          const label = m.labels[lang];
          return (
            <TabsTrigger
              key={m.mode}
              value={m.mode}
              unstyledActive
              className="gap-2 rounded-xl"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{m.mode.toUpperCase()}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
