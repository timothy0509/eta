'use client'

import { Loader2, Search, X } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  loading?: boolean
  resultCount?: number | null
  onClear?: () => void
  id?: string
  className?: string
}

export function SearchField({
  value,
  onChange,
  label,
  placeholder,
  loading,
  resultCount,
  onClear,
  id,
  className,
}: Props) {
  const inputId = id ?? 'signal-search'
  const countId = `${inputId}-count`
  const showClear = value.length > 0

  return (
    <div className={cn('w-full', className)}>
      <label htmlFor={inputId} className="signal-meta text-ink mb-1.5 block">
        {label}
      </label>
      <div
        className={cn(
          'border-trackline bg-platform text-ink flex h-11 min-h-[44px] items-center gap-2 rounded-xl border px-3 focus-within:outline-2 focus-within:outline-offset-1'
        )}
      >
        <Search className="h-4 w-4 shrink-0 opacity-60" aria-hidden />
        <input
          id={inputId}
          type="search"
          value={value}
          placeholder={placeholder}
          aria-describedby={typeof resultCount === 'number' ? countId : undefined}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:opacity-50"
        />
        {loading ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin opacity-60" aria-hidden />
        ) : null}
        {showClear ? (
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear()
              else onChange('')
            }}
            aria-label="Clear search"
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full opacity-70 transition-opacity hover:opacity-100"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
      </div>
      <p
        id={countId}
        aria-live="polite"
        className="signal-caption text-ink-soft mt-1.5 min-h-[16px]"
      >
        {typeof resultCount === 'number' ? `${resultCount} results` : ''}
      </p>
    </div>
  )
}
