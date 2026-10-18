import { describe, expect, it } from 'vitest'

import packageJson from '@/package.json'
import { APP_VERSION } from './version'

describe('APP_VERSION', () => {
  it('matches package.json unless overridden at build time', () => {
    if (process.env.NEXT_PUBLIC_APP_VERSION) {
      expect(APP_VERSION).toBe(process.env.NEXT_PUBLIC_APP_VERSION)
    } else {
      expect(APP_VERSION).toBe(packageJson.version)
    }
  })
})
