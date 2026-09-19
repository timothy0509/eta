/**
 * Server-component loading shell that mirrors the real home layout
 * (TopAppBar + SideRail/BottomNav + stops grid) so the first paint
 * already has the shell shape. Bilingual status text is hardcoded
 * so this file keeps zero store dependency.
 */
export function HomeLoading() {
  return (
    <div
      role="status"
      aria-busy
      className="bg-surface min-h-dvh overflow-x-clip pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] lg:pb-0"
    >
      <span className="sr-only">Loading… · 載入中…</span>

      {/* TopAppBar-height bar placeholder */}
      <div
        aria-hidden
        className="bg-surface-container-low/90 sticky top-0 z-40 border-b border-[var(--outline-variant)]/15"
      >
        <div className="mx-auto flex h-[3.5rem] max-w-[var(--app-max)] items-center justify-between gap-2 px-3 sm:h-14 sm:gap-3 sm:px-6">
          <div className="bg-muted/50 ui-shimmer h-8 w-8 rounded-xl min-[500px]:w-24 sm:h-9" />
          <div className="bg-muted/50 ui-shimmer h-9 w-full max-w-[420px] rounded-full" />
          <div className="flex items-center gap-2">
            <div className="bg-muted/50 ui-shimmer h-11 w-11 rounded-full" />
            <div className="bg-muted/50 ui-shimmer h-11 w-11 rounded-full" />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[var(--app-max)] gap-6 px-4 py-4 sm:px-6 sm:py-6">
        {/* SideRail placeholder, lg screens only */}
        <div
          aria-hidden
          className="bg-surface-container-low border-outline-variant/20 sticky top-20 hidden h-fit shrink-0 flex-col items-center gap-1 rounded-[28px] border px-2 py-3 shadow-sm lg:flex"
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-muted/50 ui-shimmer h-[64px] w-[64px] rounded-2xl" />
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="mx-auto max-w-[1100px]">
            {/* Stops grid: pane + results */}
            <div className="mx-auto lg:grid lg:grid-cols-[360px_1fr] lg:items-start lg:gap-6">
              <div aria-hidden className="card-m3 p-4 sm:p-5 lg:p-5">
                <div className="space-y-4">
                  <div className="bg-muted/50 ui-shimmer h-11 w-full rounded-2xl" />
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-muted/50 ui-shimmer h-7 w-20 rounded-full" />
                    <div className="bg-muted/50 ui-shimmer h-7 w-20 rounded-full" />
                    <div className="bg-muted/50 ui-shimmer h-7 w-20 rounded-full" />
                  </div>
                </div>
              </div>

              <div
                aria-hidden
                className="bg-surface-container-lowest relative mt-4 overflow-hidden rounded-3xl border border-[var(--outline-variant)]/15 p-4 shadow-sm sm:p-6 lg:mt-0"
              >
                <span className="bg-primary absolute top-0 right-0 left-0 h-[3px]" aria-hidden />
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="bg-muted/50 ui-shimmer h-6 w-40 rounded" />
                      <div className="bg-muted/50 ui-shimmer h-4 w-24 rounded" />
                    </div>
                    <div className="bg-muted/50 ui-shimmer h-10 w-10 rounded-full" />
                  </div>
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="bg-muted/50 ui-shimmer h-24 rounded-2xl" />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BottomNav placeholder, below lg only */}
      <div
        aria-hidden
        className="bg-surface-container-low fixed bottom-[max(0.75rem,env(safe-area-inset-bottom,0px))] left-1/2 z-50 w-[min(calc(100vw-1.5rem),28rem)] -translate-x-1/2 rounded-full border border-[var(--outline-variant)]/20 px-2 py-1.5 shadow-lg lg:hidden"
      >
        <div className="flex w-full items-center gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-muted/50 ui-shimmer h-12 min-w-0 flex-1 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
