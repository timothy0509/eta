"use client";

import { cn } from "@/lib/utils";
import { getRouteBadgeStyle } from "@/lib/eta/route-badge";

type Props = {
  route: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * KMB Route Badge with color-coded styling based on route type.
 * Uses header font (DM Sans) with bold weight.
 */
export function RouteBadge({ route, size = "md", className }: Props) {
  const style = getRouteBadgeStyle(route);

  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-2.5 py-1 text-sm",
    lg: "px-3 py-1 text-base",
  };

  return (
    <span
      className={cn(
        "ui-pop inline-flex items-center justify-center rounded-lg font-sans font-bold whitespace-nowrap shrink-0 border",
        sizeClasses[size],
        className
      )}
      style={{
        color: style.textColor,
        backgroundColor: style.bgColor,
        borderColor: style.bgColor === "#FFFFFF" ? "#D1D5DB" : style.bgColor,
      }}
    >
      {route}
    </span>
  );
}
