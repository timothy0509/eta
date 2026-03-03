'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

type Props = {
  children: React.ReactNode
  className?: string
  /** Speed in pixels per second (default 30) */
  speed?: number
}

/**
 * A single-line text container that scrolls horizontally when content overflows.
 * Uses duplicate content approach for seamless infinite scroll.
 * - Only animates when overflow is detected (scrollWidth > clientWidth)
 * - Pauses animation on hover / touch
 */
export function Marquee({ children, className, speed = 30 }: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [needsMarquee, setNeedsMarquee] = React.useState(false)
  const [animDuration, setAnimDuration] = React.useState(5)
  const [scrollDistance, setScrollDistance] = React.useState(0)

  // Check if content overflows and calculate animation duration
  React.useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const check = () => {
      // Find the measurement span
      const measureSpan = container.querySelector('span[data-measure]') as HTMLElement | null
      if (!measureSpan) return

      const containerW = container.clientWidth
      const contentW = measureSpan.scrollWidth
      const isOverflowing = contentW > containerW

      setNeedsMarquee(isOverflowing)

      if (isOverflowing && speed > 0) {
        // Distance to scroll = one copy width + gap
        const gap = 32 // 2rem = 32px
        const distance = contentW + gap
        setScrollDistance(distance)
        setAnimDuration(distance / speed)
      }
    }

    // Small delay to ensure DOM is ready
    requestAnimationFrame(check)

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(check)
    })
    resizeObserver.observe(container)

    return () => resizeObserver.disconnect()
  }, [children, speed])

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-hidden whitespace-nowrap',
        needsMarquee && 'marquee-container',
        className
      )}
    >
      {/* Always render a measurement span */}
      <span
        data-measure
        className={cn(
          'whitespace-nowrap',
          needsMarquee ? 'pointer-events-none invisible absolute' : 'inline-block'
        )}
      >
        {children}
      </span>

      {/* Animated track (only when overflow detected) */}
      {needsMarquee && (
        <div
          className="marquee-track inline-flex"
          style={
            {
              '--marquee-duration': `${animDuration}s`,
              '--marquee-distance': `${scrollDistance}px`,
            } as React.CSSProperties
          }
        >
          <span className="shrink-0 pr-8">{children}</span>
          <span className="shrink-0 pr-8" aria-hidden="true">
            {children}
          </span>
        </div>
      )}
    </div>
  )
}
