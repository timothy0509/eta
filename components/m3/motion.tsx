'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

type FadeInProps = React.HTMLAttributes<HTMLDivElement> & {
  delay?: number
  duration?: number
}

/**
 * CSS-only fade-in. Same API as the old framer-motion version so call
 * sites stay untouched, but no JS animation library loads with the view.
 */
export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0, duration = 0.22, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('ui-animate-fade', className)}
      style={{
        ...style,
        ...(delay ? { animationDelay: `${delay * 1000}ms` } : null),
        ...(duration && duration !== 0.22 ? { animationDuration: `${duration * 1000}ms` } : null),
      }}
      {...props}
    >
      {children}
    </div>
  )
)
FadeIn.displayName = 'FadeIn'

/**
 * CSS-only stagger container. Children animate via the `.ui-stagger`
 * nth-child delays in globals.css, capped so long lists stay cheap.
 */
export function StaggerContainer({
  children,
  className,
  stagger: _stagger = 0.04,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return <div className={cn('ui-stagger', className)}>{children}</div>
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={className}>{children}</div>
}

type MotionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  hoverScale?: number
  tapScale?: number
}

/**
 * CSS-only pressable card. hoverScale/tapScale are accepted for API
 * compat and intentionally ignored; the ui-press class handles feedback.
 */
export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ children, className, hoverScale: _hoverScale, tapScale: _tapScale, ...props }, ref) => (
    <div ref={ref} className={cn('ui-press', className)} {...props}>
      {children}
    </div>
  )
)
MotionCard.displayName = 'MotionCard'

export function LivePulse({ className }: { className?: string }) {
  return (
    <span className={cn('live-pulse relative inline-flex h-2.5 w-2.5', className)}>
      <span className="bg-primary absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping motion-reduce:hidden" />
      <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
    </span>
  )
}
