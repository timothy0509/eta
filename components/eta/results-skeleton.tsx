import * as React from 'react'
import { motion } from 'framer-motion'

import { Card, CardContent } from '@/components/ui/card'

function ShimmerBox({ delay = 0 }: { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2, delay }}
      className="bg-muted/50 relative h-24 overflow-hidden rounded-2xl"
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.5,
          delay,
          repeat: Infinity,
          ease: 'linear',
        }}
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
      />
    </motion.div>
  )
}

export function ResultsSkeleton() {
  return (
    <Card className="bg-card/60 rounded-3xl border p-0 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-3">
          <ShimmerBox delay={0} />
          <ShimmerBox delay={0.05} />
          <ShimmerBox delay={0.1} />
        </div>
      </CardContent>
    </Card>
  )
}
