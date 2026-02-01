"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import type { UiLanguage } from "@/lib/eta/types";
import { Timer } from "lucide-react";

type Props = {
  lang: UiLanguage;
  valueSeconds: number;
  onChange: (seconds: number) => void;
};


const OPTIONS = [0, 10, 15, 30, 60];

export function AutoRefreshMenu({ lang, valueSeconds, onChange }: Props) {
  const label =
    valueSeconds !== 0
      ? `${valueSeconds}s`
      : lang === "en"
        ? "Off"
        : lang === "sc"
          ? "关闭"
          : "關閉";

  const t = {
    title: lang === "en" ? "Auto refresh" : lang === "sc" ? "自動刷新" : "自動刷新",
    auto: lang === "en" ? "Auto" : lang === "sc" ? "自動" : "自動",
    off: lang === "en" ? "Off" : lang === "sc" ? "關閉" : "關閉",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Timer className="mr-2 h-4 w-4" />
          {t.auto} {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuLabel>{t.title}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map((s) => (
          <DropdownMenuItem key={s} onClick={() => onChange(s)}>
            {s ? `${s}s` : t.off}
            {s === valueSeconds ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
