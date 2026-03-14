import type { Transition, Variants } from 'framer-motion'

export const DURATION = {
  instant: 0.1,
  fast: 0.15,
  normal: 0.25,
  slow: 0.4,
} as const

export const EASE = {
  out: [0.2, 0.8, 0.2, 1] as const,
  inOut: [0.4, 0, 0.2, 1] as const,
  spring: { stiffness: 400, damping: 30, mass: 1 } as const,
  gentle: { stiffness: 300, damping: 35, mass: 0.8 } as const,
} as const

export const transition: Transition = {
  duration: DURATION.normal,
  ease: EASE.out,
}

export const springTransition: Transition = {
  ...EASE.gentle,
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 8, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.99 },
}

export const fadeScale: Variants = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
}

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

export const staggerContainer: Variants = {
  animate: {
    transition: {
      staggerChildren: 0.04,
    },
  },
}

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: { scale: 1.005, y: -2 },
  tap: { scale: 0.98 },
}

export const buttonHover = {
  rest: { scale: 1 },
  hover: { scale: 1.02 },
  tap: { scale: 0.98 },
}

export const shimmer: Variants = {
  initial: { backgroundPosition: '200% 0' },
  animate: {
    backgroundPosition: '-200% 0',
    transition: {
      duration: 1.5,
      ease: 'linear',
      repeat: Infinity,
    },
  },
}
