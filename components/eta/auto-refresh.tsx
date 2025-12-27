"use client";

import { Timer } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type Props = {
  valueSeconds: number;
  onChange: (seconds: number) => void;
};

const OPTIONS = [0, 10, 15, 30, 60];

export function AutoRefreshMenu({ valueSeconds, onChange }: Props) {
  const label = valueSeconds ? `${valueSeconds}s` : "Off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Timer className="mr-2 h-4 w-4" />
          Auto {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>Auto refresh</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            {s ? `${s}s` : "Off"}
            {s === valueSeconds ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
