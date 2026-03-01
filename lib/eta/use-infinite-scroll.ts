"use client";

import * as React from "react";

type UseInfiniteScrollOptions = {
  /** Total items available */
  totalItems: number;
  /** How many items to load initially */
  initialPageSize?: number;
  /** How many items to load on each scroll */
  pageSize?: number;
  /** Root margin for intersection observer (pixels before element is visible) */
  rootMargin?: string;
  /** Threshold for intersection observer (0-1) */
  threshold?: number;
};

type UseInfiniteScrollResult = {
  /** Number of items currently visible */
  visibleCount: number;
  /** Whether there are more items to load */
  hasMore: boolean;
  /** Ref to attach to the sentinel element at the end of the list */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  /** Manually load more items */
  loadMore: () => void;
  /** Reset to initial state */
  reset: () => void;
};

/**
 * Hook for infinite scroll loading with IntersectionObserver.
 * Automatically loads more items when the sentinel element comes into view.
 */
export function useInfiniteScroll(
  options: UseInfiniteScrollOptions
): UseInfiniteScrollResult {
  const {
    totalItems,
    initialPageSize = 10,
    pageSize = 10,
    rootMargin = "200px",
    threshold = 0.1,
  } = options;

  const [visibleCount, setVisibleCount] = React.useState(
    Math.min(initialPageSize, totalItems)
  );
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  // Reset when total items changes significantly (new query)
  const prevTotalRef = React.useRef(totalItems);
  React.useEffect(() => {
    if (totalItems !== prevTotalRef.current) {
      prevTotalRef.current = totalItems;
      setVisibleCount(Math.min(initialPageSize, totalItems));
    }
  }, [totalItems, initialPageSize]);

  const hasMore = visibleCount < totalItems;

  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(prev + pageSize, totalItems));
  }, [pageSize, totalItems]);

  const reset = React.useCallback(() => {
    setVisibleCount(Math.min(initialPageSize, totalItems));
  }, [initialPageSize, totalItems]);

  // Set up intersection observer
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          loadMore();
        }
      },
      {
        rootMargin,
        threshold,
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, loadMore, rootMargin, threshold]);

  return {
    visibleCount,
    hasMore,
    sentinelRef,
    loadMore,
    reset,
  };
}

/**
 * Hook to track which items are currently visible in the viewport.
 * Useful for refreshing only visible items.
 */
export function useVisibleItems<T extends string | number>(
  itemIds: T[],
  options?: { rootMargin?: string }
): {
  visibleIds: Set<T>;
  registerRef: (id: T) => (el: HTMLElement | null) => void;
} {
  const [visibleIds, setVisibleIds] = React.useState<Set<T>>(new Set());
  const elementsRef = React.useRef<Map<T, HTMLElement>>(new Map());
  const observerRef = React.useRef<IntersectionObserver | null>(null);

  // Create observer once
  React.useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          let changed = false;
          const next = new Set(prev);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.itemId as T | undefined;
            if (id === undefined) continue;

            if (entry.isIntersecting) {
              if (!next.has(id)) {
                next.add(id);
                changed = true;
              }
            } else if (next.has(id)) {
              next.delete(id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      {
        rootMargin: options?.rootMargin ?? "50px",
        threshold: 0.1,
      }
    );

    return () => {
      observerRef.current?.disconnect();
    };
  }, [options?.rootMargin]);

  // Re-observe when itemIds change
  React.useEffect(() => {
    const observer = observerRef.current;
    if (!observer) return;

    // Observe all registered elements
    const validIds = new Set(itemIds);
    for (const [id, el] of elementsRef.current.entries()) {
      if (validIds.has(id)) {
        observer.observe(el);
      } else {
        observer.unobserve(el);
        elementsRef.current.delete(id);
      }
    }

    return () => {
      observer.disconnect();
    };
  }, [itemIds]);

  const registerRef = React.useCallback(
    (id: T) => (el: HTMLElement | null) => {
      const observer = observerRef.current;
      if (!observer) return;

      const existing = elementsRef.current.get(id);
      if (existing) {
        observer.unobserve(existing);
      }

      if (el) {
        el.dataset.itemId = String(id);
        elementsRef.current.set(id, el);
        observer.observe(el);
      } else {
        elementsRef.current.delete(id);
      }
    },
    []
  );

  return { visibleIds, registerRef };
}
