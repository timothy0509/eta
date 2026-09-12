'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import * as React from 'react'

import { cn } from '@/lib/utils'

const FADE_DURATION = 0.22
const STAGGER_STEP = 0.03
const MAX_STAGGER_INDEX = 5

type FadeInProps = Omit<HTMLMotionProps<'div'>, 'children'> & {
  children?: React.ReactNode
  delay?: number
  duration?: number
  staggerIndex?: number
}

export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  (
    { children, className, delay = 0, duration = FADE_DURATION, staggerIndex = 0, ...props },
    ref
  ) => {
    const reduceMotion = useReducedMotion()
    if (reduceMotion) {
      return (
        <div ref={ref} className={className}>
          {children}
        </div>
      )
    }
    const capped = Math.max(0, Math.min(MAX_STAGGER_INDEX, Math.floor(staggerIndex)))
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration, delay: delay + capped * STAGGER_STEP, ease: [0.2, 0.8, 0.2, 1] }}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
FadeIn.displayName = 'FadeIn'

// Backward-compatible wrappers. They render a single FadeIn or plain div so
// pages keep working without the old triple motion stack.
export function StaggerContainer({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return <div className={className}>{children}</div>
}

export function StaggerItem({
  children,
  className,
  index = 0,
}: {
  children: React.ReactNode
  className?: string
  index?: number
}) {
  return (
    <FadeIn className={className} staggerIndex={index}>
      {children}
    </FadeIn>
  )
}

type MotionCardProps = React.HTMLAttributes<HTMLDivElement> & {
  children?: React.ReactNode
  hoverScale?: number
  tapScale?: number
}

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
