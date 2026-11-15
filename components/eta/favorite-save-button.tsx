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
  /** Extra classes for the label wrapper, e.g. container-query collapsing. */
  labelClassName?: string
}

/**
 * Shared favorite-save button. The heart pops only after a click:
 * the pop class is gated on `saveCount > 0` so mounting never plays it.
 * Icon-to-label spacing comes from the button gap (not an icon margin) so
 * the icon stays centered when the label collapses to icon-only.
 */
export function FavoriteSaveButton({ onSave, label, disabled, className, labelClassName }: Props) {
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
        <Heart className="h-4 w-4 shrink-0" aria-hidden />
      </span>
      {labelClassName ? <span className={labelClassName}>{label}</span> : label}
    </Button>
  )
}
