"use client";

import * as React from "react";

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatUiLanguageLabel } from "@/lib/eta/format";
import { isLanguageSupported } from "@/lib/eta/types";
import type { TransportMode, UiLanguage } from "@/lib/eta/types";

type Props = {
  mode: TransportMode;
  value: UiLanguage;
  onChange: (value: UiLanguage) => void;
};

export function LanguageToggle({ mode, value: lang, onChange }: Props) {

  const supported = React.useMemo(
    () => ({
      en: isLanguageSupported(mode, "en"),
      tc: isLanguageSupported(mode, "tc"),
      sc: isLanguageSupported(mode, "sc"),
    }),
    [mode]
  );

  return (
    <div className="flex items-center gap-2">
      <ToggleGroup
        type="single"
        value={lang}
        onValueChange={(nextValue) => {

          if (!nextValue) return;
          onChange(nextValue as UiLanguage);
        }}
        className="rounded-xl border bg-card p-1"
      >
        <ToggleGroupItem value="en" aria-label="English">
          {formatUiLanguageLabel("en")}
        </ToggleGroupItem>
        <ToggleGroupItem value="tc" aria-label="Traditional Chinese">
          {formatUiLanguageLabel("tc")}
        </ToggleGroupItem>
        <Tooltip>
          <TooltipTrigger asChild>
            <span aria-disabled={!supported.sc}>
              <ToggleGroupItem
                value="sc"
                aria-label="Simplified Chinese"
                disabled={!supported.sc}
              >
                {formatUiLanguageLabel("sc")}
              </ToggleGroupItem>
            </span>
          </TooltipTrigger>
          {!supported.sc ? (
            <TooltipContent>
              {lang === "en"
                ? "API doesn’t support Simplified for this mode"
                : lang === "sc"
                  ? "此模式不支持简体中文"
                  : "此模式不支援簡體中文"}
            </TooltipContent>
          ) : null}

        </Tooltip>
      </ToggleGroup>
    </div>
  );
}
