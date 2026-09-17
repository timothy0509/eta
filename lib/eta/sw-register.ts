let registered = false

/** Register the shell-only service worker. Safe to call repeatedly. */
export function registerServiceWorker(): void {
  if (registered) return
  if (typeof window === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  // Only the production static shell ships /sw.js.
  if (process.env.NODE_ENV !== 'production') return
  registered = true

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      registered = false
    })
  }

  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(register, { timeout: 4000 })
  } else {
    window.addEventListener('load', register, { once: true })
  }
}
