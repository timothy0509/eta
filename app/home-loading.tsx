import { Card, CardContent } from "@/components/ui/card";

export function HomeLoading() {
  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-background via-background to-muted/30">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />
      
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-2">
          <div className="ui-animate-in flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TimoETA</h1>
              <p className="mt-1 text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
          
          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
            <Card className="rounded-3xl border bg-card/60 p-0 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="h-8 w-32 animate-pulse rounded bg-muted" />
                <div className="h-20 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
            <Card className="rounded-3xl border bg-card/60 p-0 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="h-8 w-48 animate-pulse rounded bg-muted" />
                <div className="h-40 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
