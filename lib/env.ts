const NEXT_PUBLIC_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL

// Only validate at runtime, not during build.
// During `next build`, NODE_ENV is 'production' but the app isn't serving requests yet.
// We detect runtime by checking for NEXT_RUNTIME (set by Next.js at request time).
const isRuntime = typeof process.env.NEXT_RUNTIME !== 'undefined'

if (!NEXT_PUBLIC_SITE_URL && isRuntime) {
  console.warn('NEXT_PUBLIC_SITE_URL is not set, using default')
}

export const env = {
  NEXT_PUBLIC_SITE_URL: NEXT_PUBLIC_SITE_URL ?? 'https://eta.hkjc.uk',
}
