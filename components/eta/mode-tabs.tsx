"use client";

import { Bus, TrainFront, TramFront } from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TransportMode } from "@/lib/eta/types";

const MODES: Array<{
  mode: TransportMode;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { mode: "kmb", label: "KMB Bus", icon: Bus },
  { mode: "mtr", label: "MTR", icon: TrainFront },
  { mode: "lrt", label: "Light Rail", icon: TramFront },
];

type Props = {
  value: TransportMode;
  onChange: (mode: TransportMode) => void;
};

export function ModeTabs({ value, onChange }: Props) {
  return (
    <Tabs
      value={value}
      onValueChange={(nextValue) => onChange(nextValue as TransportMode)}
    >
      <TabsList className="grid w-full grid-cols-3 rounded-2xl">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <TabsTrigger
              key={m.mode}
              value={m.mode}
              className="gap-2 rounded-xl"
            >
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{m.label}</span>
              <span className="sm:hidden">{m.mode.toUpperCase()}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
