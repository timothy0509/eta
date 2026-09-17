'use client'

import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import * as React from 'react'

import { cn } from '@/lib/utils'

type FadeInProps = HTMLMotionProps<'div'> & {
  delay?: number
  duration?: number
}

export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0, duration = 0.25, ...props }, ref) => {
    const reduceMotion = useReducedMotion()
    return (
      <motion.div
        ref={ref}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          reduceMotion ? { duration: 0, delay: 0 } : { duration, delay, ease: [0.2, 0.8, 0.2, 1] }
        }
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    )
  }
)
FadeIn.displayName = 'FadeIn'

export function LivePulse({ className }: { className?: string }) {
  return (
    <span className={cn('live-pulse relative inline-flex h-2.5 w-2.5', className)}>
      <span className="bg-primary absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping motion-reduce:hidden" />
      <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
    </span>
  )
}
