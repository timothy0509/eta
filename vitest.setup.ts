// Newer Node majors ship an experimental Web Storage that stays unavailable without
// extra flags, and the jsdom build used here then exposes no window.localStorage.
// Install a minimal in-memory stand-in when it is missing so storage-backed hooks
// keep working under every supported Node. On Node 22 jsdom provides the real
// thing and this file does nothing.

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null
  }

  getItem(key: string): string | null {
    return this.store.get(String(key)) ?? null
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value))
  }

  removeItem(key: string): void {
    this.store.delete(String(key))
  }

  clear(): void {
    this.store.clear()
  }
}

function storageMissing(name: 'localStorage' | 'sessionStorage'): boolean {
  try {
    if (typeof window === 'undefined') {
      return true
    }
    const value = window[name]
    return value === undefined || value === null
  } catch {
    return true
  }
}

function installStorage(name: 'localStorage' | 'sessionStorage'): void {
  const storage = new MemoryStorage()
  Object.defineProperty(window, name, {
    value: storage,
    configurable: true,
    writable: true,
  })
  Object.defineProperty(globalThis, name, {
    value: storage,
    configurable: true,
    writable: true,
  })
}

if (typeof window !== 'undefined') {
  if (storageMissing('localStorage')) {
    installStorage('localStorage')
  }
  if (storageMissing('sessionStorage')) {
    installStorage('sessionStorage')
  }
}
