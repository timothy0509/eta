/**
 * Simple analytics module.
 *
 * In development: logs to console.
 * In production: placeholder ready for PostHog, GA4, or similar service integration.
 */

type EventProperties = Record<string, unknown>

let isInitialized = false

export function initAnalytics() {
  if (isInitialized) return
  isInitialized = true

  if (process.env.NODE_ENV === 'production') {
    // TODO: Initialize analytics service
    // posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '')
  }
}

export function trackEvent(name: string, properties?: EventProperties) {
  const event = {
    name,
    properties,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event)
    return
  }

  // Production: placeholder for analytics service
  // TODO: Send to PostHog, GA4, or similar
  // posthog.capture(name, properties)
  if (process.env.NODE_ENV === 'production') {
    // Silent in production until service is configured
  }
}

export function trackPageView(path?: string) {
  trackEvent('page_view', {
    path: path ?? (typeof window !== 'undefined' ? window.location.pathname : undefined),
  })
}
