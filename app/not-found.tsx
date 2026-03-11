import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="from-background via-background to-muted/30 relative min-h-dvh bg-gradient-to-b">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex min-h-[60vh] flex-col justify-center">
          <div className="max-w-2xl space-y-4">
            <h1 className="text-2xl font-semibold">Page not found</h1>
            <p className="text-muted-foreground text-sm">
              We could not find the page you are looking for.
            </p>
            <Button asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
