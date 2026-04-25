"use client";

import { cn } from "@/lib/utils";
import { BUS_COMPANIES } from "@/lib/hkbus/constants";
import type { BusCompany } from "@/lib/hkbus/types";

const OPERATOR_LABELS: Record<BusCompany, string> = {
  kmb: "KMB",
  ctb: "Citybus",
  nlb: "NLB",
  gmb: "GMB",
  lrtfeeder: "LRT",
};

interface OperatorTabsProps {
  selected: BusCompany | null;
  onSelect: (operator: BusCompany | null) => void;
}

export function OperatorTabs({ selected, onSelect }: OperatorTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
          "whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
          selected === null
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        All
      </button>
      {BUS_COMPANIES.map((company) => (
        <button
          key={company}
          onClick={() => onSelect(company)}
          className={cn(
            "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-150",
            "whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
            selected === company
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {OPERATOR_LABELS[company]}
        </button>
      ))}
    </div>
  );
}
