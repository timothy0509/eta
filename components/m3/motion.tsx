'use client'

import { motion, type HTMLMotionProps } from 'framer-motion'
import * as React from 'react'

import { cn } from '@/lib/utils'

type FadeInProps = HTMLMotionProps<'div'> & {
  delay?: number
  duration?: number
}

export const FadeIn = React.forwardRef<HTMLDivElement, FadeInProps>(
  ({ children, className, delay = 0, duration = 0.25, ...props }, ref) => (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
)
FadeIn.displayName = 'FadeIn'

export function StaggerContainer({
  children,
  className,
  stagger = 0.04,
}: {
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: stagger } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 8 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.22, ease: [0.2, 0.8, 0.2, 1] } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

type MotionCardProps = Omit<HTMLMotionProps<'div'>, 'whileHover' | 'whileTap'> & {
  hoverScale?: number
  tapScale?: number
}

export const MotionCard = React.forwardRef<HTMLDivElement, MotionCardProps>(
  ({ children, className, hoverScale = 1.01, tapScale = 0.99, ...props }, ref) => (
    <motion.div
      ref={ref}
      whileHover={{ scale: hoverScale }}
      whileTap={{ scale: tapScale }}
      transition={{ duration: 0.14, ease: [0.2, 0.8, 0.2, 1] }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  )
)
MotionCard.displayName = 'MotionCard'

export function LivePulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      <span className="bg-primary absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
      <span className="bg-primary relative inline-flex h-2.5 w-2.5 rounded-full" />
    </span>
  )
}
