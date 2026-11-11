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

/**
 * View-root entrance for mode and subview switches. Same delay and
 * duration props as FadeIn so call sites read the same way.
 */
export const PaneEnter = React.forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0, duration = 0.22, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('ui-pane-enter', className)}
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
PaneEnter.displayName = 'PaneEnter'

/**
 * ETA text that replays its rise animation only when the displayed
 * value changes. Callers must pass `key={value}` alongside the value:
 * the key remount is what replays the animation, so identical
 * refreshes keep the same key and stay still.
 */
export function EtaValue({ value, className }: { value: string; className?: string }) {
  return <span className={cn('ui-eta-tick', className)}>{value}</span>
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

/**
 * Cap on concurrently animated LivePulse dots. Each arriving ETA row renders
 * one, and every instance runs two infinite animations (the Tailwind ping plus
 * the outer live-pulse), which keeps mobile GPUs busy during scroll. Only the
 * first mounts animate; the rest render the same solid dot without animation.
 */
export const MAX_ANIMATED_LIVE_PULSES = 3

// Claimed-slot set plus a version bumped on every claim change. LivePulse
// instances subscribe to the version and read their own membership during
// render, so queued waiters promote without refs-in-render or
// setState-in-effect.
const pulseStore = {
  held: 0,
  version: 0,
  listeners: new Set<() => void>(),
}
const heldPulseIds = new Set<string>()

function subscribePulseStore(listener: () => void): () => void {
  pulseStore.listeners.add(listener)
  return () => {
    pulseStore.listeners.delete(listener)
  }
}

function notifyPulseStore(): void {
  pulseStore.version += 1
  for (const listener of Array.from(pulseStore.listeners)) listener()
}

// Overflow instances waiting for a slot. Invoked FIFO when a holder
// releases; a promoted waiter claims the freed slot and notifies.
const pulseWaiters = new Set<() => void>()

function releasePulseClaim(): void {
  pulseStore.held = Math.max(0, pulseStore.held - 1)
  const next = pulseWaiters.values().next().value as (() => void) | undefined
  if (next) {
    pulseWaiters.delete(next)
    next()
  } else {
    notifyPulseStore()
  }
}

/** Test-only reset for the module-level slot counter. */
export function __resetLivePulseSlotsForTests(): void {
  pulseStore.held = 0
  pulseStore.version = 0
  pulseStore.listeners.clear()
  heldPulseIds.clear()
  pulseWaiters.clear()
}

export function LivePulse({
  className,
  animate = true,
}: {
  className?: string
  /** False renders the static dot, skipping the slot claim entirely. */
  animate?: boolean
}) {
  const id = React.useId()
  // Re-renders this instance when slots change hands. Server snapshot is
  // always false so SSR emits the static dot and hydration matches.
  const holdsSlot = React.useSyncExternalStore(
    subscribePulseStore,
    () => heldPulseIds.has(id),
    () => false
  )
  const animated = animate && holdsSlot

  React.useEffect(() => {
    if (!animate) return
    function promote(): void {
      if (pulseStore.held < MAX_ANIMATED_LIVE_PULSES) {
        pulseStore.held += 1
        heldPulseIds.add(id)
        notifyPulseStore()
      } else {
        pulseWaiters.add(promote)
      }
    }
    if (pulseStore.held < MAX_ANIMATED_LIVE_PULSES) {
      pulseStore.held += 1
      heldPulseIds.add(id)
      notifyPulseStore()
    } else {
      pulseWaiters.add(promote)
    }
    return () => {
      pulseWaiters.delete(promote)
      if (heldPulseIds.delete(id)) releasePulseClaim()
    }
  }, [animate, id])

  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', animated && 'live-pulse', className)}>
      {animated ? (
        <span className="bg-primary absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping motion-reduce:hidden" />
      ) : null}
      <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
    </span>
  )
}
