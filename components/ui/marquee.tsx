"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Speed in pixels per second (default 30) */
  speed?: number;
};

/**
 * A single-line text container that scrolls horizontally when content overflows.
 * - Only animates when overflow is detected (scrollWidth > clientWidth)
 * - Pauses animation on hover / touch
 */
export function Marquee({ children, className, speed = 30 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = React.useState(false);
  const [duration, setDuration] = React.useState(0);

  React.useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const checkOverflow = () => {
      const isOverflowing = content.scrollWidth > container.clientWidth;
      setOverflow(isOverflowing);
      if (isOverflowing && speed > 0) {
        // Calculate duration based on overflow amount
        const overflowAmount = content.scrollWidth - container.clientWidth;
        // Add some extra for the gap between repeated content
        const totalDistance = overflowAmount + 40;
        setDuration(totalDistance / speed);
      }
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, [children, speed]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden whitespace-nowrap",
        overflow && "marquee-container",
        className
      )}
    >
      <span
        ref={contentRef}
        className={cn(
          "inline-block",
          overflow && "marquee-content"
        )}
        style={overflow ? { "--marquee-duration": `${duration}s` } as React.CSSProperties : undefined}
      >
        {children}
      </span>
    </div>
  );
}
