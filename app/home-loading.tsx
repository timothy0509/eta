import { Card, CardContent } from '@/components/ui/card'

export function HomeLoading() {
  return (
    <div className="from-background via-background to-muted/30 relative min-h-dvh bg-gradient-to-b">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-2">
          <div className="ui-animate-in flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TimoETA</h1>
              <p className="text-muted-foreground mt-1 text-sm">Loading...</p>
            </div>
          </div>

          <div className="mx-auto mt-6 max-w-7xl lg:grid lg:grid-cols-[280px_1fr] lg:gap-8">
            <CardContent className="space-y-4 p-4 sm:p-5 lg:p-0 lg:pr-6">
              <div className="bg-muted h-10 w-full animate-pulse rounded-full" />
              <div className="flex flex-wrap items-center gap-3">
                <div className="bg-muted h-8 w-24 animate-pulse rounded-full" />
                <div className="bg-muted h-8 w-32 animate-pulse rounded-full" />
              </div>
            </CardContent>
            <Card className="bg-card/60 relative overflow-hidden rounded-3xl border shadow-sm">
              <span className="bg-primary absolute top-0 right-0 left-0 h-1" aria-hidden />
              <CardContent className="space-y-4 p-4 sm:p-5">
                <div className="bg-muted h-8 w-48 animate-pulse rounded" />
                <div className="bg-muted h-40 animate-pulse rounded" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
