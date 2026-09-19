'use client'

import { Heart } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type Props = {
  onSave: () => void
  label: string
  disabled?: boolean
  className?: string
}

/**
 * Shared favorite-save button. The heart pops only after a click:
 * the pop class is gated on `saveCount > 0` so mounting never plays it.
 */
export function FavoriteSaveButton({ onSave, label, disabled, className }: Props) {
  const [saveCount, setSaveCount] = React.useState(0)
  return (
    <Button
      size="sm"
      className={cn('ui-press min-h-[44px] rounded-full shadow-sm', className)}
      disabled={disabled}
      onClick={() => {
        onSave()
        setSaveCount((c) => c + 1)
      }}
    >
      <span key={saveCount} className={cn('inline-flex', saveCount > 0 && 'ui-fav-pop')}>
        <Heart className="mr-1.5 h-4 w-4" />
      </span>
      {label}
    </Button>
  )
}
