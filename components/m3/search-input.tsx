'use client'

import { Search, X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type SearchInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  value: string
  onChange: (value: string) => void
  onClear?: () => void
  label?: string
  isLoading?: boolean
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ value, onChange, onClear, label, isLoading, className, ...props }, ref) => {
    const id = React.useId()

    return (
      <div className={cn('relative', className)}>
        {label && (
          <label htmlFor={id} className="m3-label-md text-on-surface-variant mb-1.5 block">
            {label}
          </label>
        )}
        <div className="relative">
          <Search className="text-on-surface-variant absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            ref={ref}
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
              'bg-surface-container-high text-on-surface m3-body-md w-full rounded-full py-3 pr-10 pl-10 transition-colors',
              'placeholder:text-on-surface-variant/60',
              'focus:bg-surface-container focus:ring-primary/30 focus:ring-2 focus:outline-none',
              isLoading && 'opacity-60'
            )}
            {...props}
          />
          {value && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-on-surface-variant hover:text-on-surface absolute top-1/2 right-3 -translate-y-1/2 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    )
  }
)
SearchInput.displayName = 'SearchInput'
