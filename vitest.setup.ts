// jsdom in this repo resolves window.localStorage as undefined, so tests that
// touch storage throw before any assertion runs. Provide a small in-memory
// stub, but only when the real one is missing.
const globalScope = globalThis as Record<string, unknown>

if (typeof window !== 'undefined' && typeof window.localStorage === 'undefined') {
  const store = new Map<string, string>()
  const stub = {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key: string) {
      return store.has(key) ? (store.get(key) as string) : null
    },
    key(index: number) {
      return [...store.keys()][index] ?? null
    },
    removeItem(key: string) {
      store.delete(key)
    },
    setItem(key: string, value: string) {
      store.set(String(key), String(value))
    },
  }
  Object.defineProperty(window, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  })
  if (typeof globalScope.localStorage === 'undefined') {
    Object.defineProperty(globalScope, 'localStorage', {
      value: stub,
      configurable: true,
      writable: true,
    })
  }
}
