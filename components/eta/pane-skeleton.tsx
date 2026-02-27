"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Skeleton loading state for transport mode panes
 * Shows a spinner and placeholder text while dynamic imports load
 */
export function PaneSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-8 text-muted-foreground",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">Loading...</span>
    </div>
  );
}
