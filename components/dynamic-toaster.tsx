'use client'

import dynamic from 'next/dynamic'

const Toaster = dynamic(() => import('@/components/toaster').then((m) => m.Toaster), {
  ssr: false,
})

export function DynamicToaster() {
  return <Toaster />
}
