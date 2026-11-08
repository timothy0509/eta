import { describe, expect, it } from 'vitest'

import { isKmbFamily, isLwbRoute, resolveAppCompany } from '@/lib/eta/companies'

describe('isLwbRoute', () => {
  it('accepts TD GTFS LWB short names in any case', () => {
    expect(isLwbRoute('A31')).toBe(true)
    expect(isLwbRoute(' a31 ')).toBe(true)
    expect(isLwbRoute('E42C')).toBe(true)
    expect(isLwbRoute('S64')).toBe(true)
  })

  it('leaves KMB-only route numbers alone', () => {
    expect(isLwbRoute('1')).toBe(false)
    expect(isLwbRoute('N213')).toBe(false)
    expect(isLwbRoute('')).toBe(false)
  })
})

describe('isKmbFamily', () => {
  it('treats KMB and LWB as one data family', () => {
    expect(isKmbFamily('kmb')).toBe(true)
    expect(isKmbFamily('LWB')).toBe(true)
    expect(isKmbFamily('ctb')).toBe(false)
  })
})

describe('resolveAppCompany', () => {
  it('moves LWB routes out of the upstream kmb bucket', () => {
    expect(resolveAppCompany('kmb', 'A31')).toBe('lwb')
    expect(resolveAppCompany('KMB', 'a31')).toBe('lwb')
  })

  it('keeps KMB routes and other companies unchanged', () => {
    expect(resolveAppCompany('kmb', '1')).toBe('kmb')
    expect(resolveAppCompany('ctb', 'A31')).toBe('ctb')
    expect(resolveAppCompany(undefined, 'A31')).toBe('lwb')
  })

  it('defaults a missing company to kmb', () => {
    expect(resolveAppCompany(undefined, '1')).toBe('kmb')
  })
})
