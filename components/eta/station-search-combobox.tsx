'use client'

import * as React from 'react'
import { Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  listId: string
  triggerLabel: string | null
  triggerPlaceholder: string
  inputPlaceholder: string
  inputAriaLabel: string
  query: string
  onQueryChange: (query: string) => void
  emptyText: string
  groupHeading: string
  triggerIcon?: React.ComponentType<{ className?: string }>
  listClassName?: string
  children: React.ReactNode
}

export function StationSearchCombobox({
  open,
  onOpenChange,
  listId,
  triggerLabel,
  triggerPlaceholder,
  inputPlaceholder,
  inputAriaLabel,
  query,
  onQueryChange,
  emptyText,
  groupHeading,
  triggerIcon: TriggerIcon = Search,
  listClassName,
  children,
}: Props) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-haspopup="listbox"
          className={cn(
            'bg-surface-container-high text-on-surface w-full min-w-0 justify-start rounded-2xl border border-[var(--outline-variant)]/20 py-5 text-left shadow-sm',
            'hover:bg-surface-container transition-[box-shadow,border-color,background-color,transform] hover:border-[var(--outline-variant)]/30',
            !triggerLabel && 'text-on-surface-variant'
          )}
        >
          <TriggerIcon className="text-on-surface-variant mr-2 h-4 w-4 shrink-0" />
          <span className="m3-body-md truncate">{triggerLabel ?? triggerPlaceholder}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="bg-surface-container-low ui-popover-in data-[state=closed]:ui-animate-fade w-[min(560px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--outline-variant)]/20 p-0 shadow-lg"
        align="start"
      >
        <Command shouldFilter={false} className="rounded-none bg-transparent">
          <CommandInput
            placeholder={inputPlaceholder}
            aria-label={inputAriaLabel}
            value={query}
            onValueChange={onQueryChange}
            className="m3-body-md border-b-0"
          />
          <CommandList id={listId} className={cn('max-h-[400px] py-2', listClassName)}>
            <CommandEmpty className="text-on-surface-variant m3-body-md py-8 text-center">
              {emptyText}
            </CommandEmpty>
            <CommandGroup
              heading={groupHeading}
              className="text-on-surface-variant m3-label-md px-3 pt-0 pb-2"
            >
              {children}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
