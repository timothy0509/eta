'use client'

import * as React from 'react'

import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'

type Props = {
  open: boolean
  side: 'right' | 'bottom'
  title: string
  onOpenChange: (next: boolean) => void
  children: React.ReactNode
  bodyPadding?: boolean
}

export function SavedSheet({ open, side, title, onOpenChange, children, bodyPadding }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} id="saved-panel">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <SheetBody className={bodyPadding ? 'px-4' : undefined}>{children}</SheetBody>
      </SheetContent>
    </Sheet>
  )
}
