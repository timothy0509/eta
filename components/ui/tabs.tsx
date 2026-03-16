'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'

import { cn } from '@/lib/utils'

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    />
  )
}

type TabsListProps = React.ComponentProps<typeof TabsPrimitive.List> & {
  /** Renders an animated pill behind the active trigger. */
  withIndicator?: boolean
  /** Optional className for the indicator pill. */
  indicatorClassName?: string
}

function TabsList({
  className,
  withIndicator = false,
  indicatorClassName,
  ...props
}: TabsListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = React.useState<{
    left: number
    top: number
    width: number
    height: number
    visible: boolean
  }>({ left: 0, top: 0, width: 0, height: 0, visible: false })

  const updateIndicator = React.useCallback(() => {
    if (!withIndicator) return

    const list = listRef.current
    if (!list) return

    const active = list.querySelector(
      '[data-slot="tabs-trigger"][data-state="active"]'
    ) as HTMLElement | null

    if (!active) {
      setIndicator((prev) => ({ ...prev, visible: false }))
      return
    }

    setIndicator({
      left: active.offsetLeft,
      top: active.offsetTop,
      width: active.offsetWidth,
      height: active.offsetHeight,
      visible: true,
    })
  }, [withIndicator])

  React.useLayoutEffect(() => {
    if (!withIndicator) return

    const list = listRef.current
    if (!list) return

    const raf = requestAnimationFrame(updateIndicator)

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateIndicator)
    })
    resizeObserver.observe(list)

    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(updateIndicator)
    })

    mutationObserver.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-state'],
    })

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
    }
  }, [updateIndicator, withIndicator])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(
        'glass text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]',
        withIndicator && 'relative isolate',
        className
      )}
      {...props}
    >
      {withIndicator && indicator.visible ? (
        <span
          aria-hidden="true"
          className={cn(
            'bg-background/80 dark:bg-input/30 pointer-events-none absolute top-0 left-0 z-0 rounded-md border border-transparent shadow-sm backdrop-blur-sm transition-[transform,width,height] duration-200 ease-out motion-reduce:transition-none',
            indicatorClassName
          )}
          style={{
            width: indicator.width,
            height: indicator.height,
            transform: `translate3d(${indicator.left}px, ${indicator.top}px, 0)`,
          }}
        />
      ) : null}

      {props.children}
    </TabsPrimitive.List>
  )
}

type TabsTriggerProps = React.ComponentProps<typeof TabsPrimitive.Trigger> & {
  /**
   * When true, disables the built-in active background/shadow.
   * Useful when using `TabsList` `withIndicator`.
   */
  unstyledActive?: boolean
}

function TabsTrigger({ className, unstyledActive = false, ...props }: TabsTriggerProps) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "ui-press focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground dark:text-muted-foreground dark:data-[state=active]:text-foreground relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        !unstyledActive &&
          'data-[state=active]:bg-background dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30 data-[state=active]:shadow-sm',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
