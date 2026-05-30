/**
 * Simple error reporting module.
 *
 * In development: logs to console.
 * In production: placeholder ready for Sentry or similar service integration.
 */

type ErrorContext = Record<string, unknown>

let isInitialized = false

export function initErrorReporting() {
  if (isInitialized) return
  isInitialized = true

  if (process.env.NODE_ENV === 'production') {
    // TODO: Initialize Sentry or other error reporting service
    // Sentry.init({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN })
  }
}

export function reportError(error: Error, context?: ErrorContext) {
  const info = {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('[ErrorReport]', info)
    return
  }

  // Production: placeholder for error reporting service
  // TODO: Send to Sentry, LogRocket, or similar
  // Sentry.captureException(error, { contexts: { custom: context } })
  console.error('[ErrorReport:production]', info)
}
