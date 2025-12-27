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
 * Uses duplicate content approach for seamless infinite scroll.
 * - Only animates when overflow is detected (scrollWidth > clientWidth)
 * - Pauses animation on hover / touch
 */
export function Marquee({ children, className, speed = 30 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const contentRef = React.useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = React.useState(false);
  const [duration, setDuration] = React.useState(5);

  React.useEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const checkOverflow = () => {
      const isOverflowing = content.scrollWidth > container.clientWidth;
      setOverflow(isOverflowing);
      if (isOverflowing && speed > 0) {
        // Duration based on full content width (one copy) + gap
        const contentWidth = content.scrollWidth;
        const gap = 32; // 2rem gap between copies
        setDuration((contentWidth + gap) / speed);
      }
    };

    checkOverflow();

    const observer = new ResizeObserver(checkOverflow);
    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, [children, speed]);

  // Non-overflowing: just render content normally
  if (!overflow) {
    return (
      <div
        ref={containerRef}
        className={cn("overflow-hidden whitespace-nowrap", className)}
      >
        <span ref={contentRef} className="inline-block">
          {children}
        </span>
      </div>
    );
  }

  // Overflowing: render with duplicate content for seamless scroll
  return (
    <div
      ref={containerRef}
      className={cn("marquee-container overflow-hidden whitespace-nowrap", className)}
    >
      {/* Hidden span for measuring content width */}
      <span ref={contentRef} className="invisible absolute whitespace-nowrap">
        {children}
      </span>

      {/* Animated track with two copies */}
      <div
        className="marquee-track inline-flex"
        style={{ "--marquee-duration": `${duration}s` } as React.CSSProperties}
      >
        <span className="shrink-0 pr-8">{children}</span>
        <span className="shrink-0 pr-8" aria-hidden="true">
          {children}
        </span>
      </div>
    </div>
  );
}
