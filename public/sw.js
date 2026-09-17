/* TimoETA shell-only service worker.
 * Caches the app shell and static assets. Never caches live ETA traffic:
 * all cross-origin requests pass straight through to the network so the
 * MicroCache/IDB layer in lib/eta remains the single source of truth.
 */

const SHELL_CACHE = 'timoeta-shell-v1'
const PRECACHE = ['/', '/site.webmanifest']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
      .catch(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

function isShellAsset(url) {
  if (url.origin !== self.location.origin) return false
  if (url.pathname.startsWith('/_next/static/')) return true
  if (url.pathname === '/site.webmanifest') return true
  if (/^\/(icon|apple-icon|android-chrome|timoeta_new)(\.[^/]+)?$/.test(url.pathname)) return true
  return false
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  let url
  try {
    url = new URL(request.url)
  } catch {
    return
  }

  // Cross-origin (upstream ETAs, tiles, fonts) always goes to the network.
  if (url.origin !== self.location.origin) return

  // Navigations: network first, fall back to cached shell for offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put('/', copy))
              .catch(() => {})
          }
          return response
        })
        .catch(() => caches.match('/', { cacheName: SHELL_CACHE }))
    )
    return
  }

  if (!isShellAsset(url)) return

  // Static shell assets: cache first, revalidate in the background.
  event.respondWith(
    caches.match(request, { cacheName: SHELL_CACHE }).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches
              .open(SHELL_CACHE)
              .then((cache) => cache.put(request, copy))
              .catch(() => {})
          }
          return response
        })
        .catch(() => cached)
      return cached || network
    })
  )
})
