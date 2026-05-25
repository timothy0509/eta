import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, fetchJson, UpstreamTimeoutError } from './http'

declare const global: { fetch: typeof fetch }

describe('fetchJson', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns JSON for ok responses', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await fetchJson<{ ok: boolean }>('https://example.com')

    expect(result.ok).toBe(true)
  })

  it('throws ApiError with sanitized body for non-ok responses', async () => {
    const response = new Response('<html>fail</html>', { status: 500 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(fetchJson('https://example.com')).rejects.toBeInstanceOf(ApiError)
  })

  it('sanitizes non-HTML body into ApiError message', async () => {
    const response = new Response('upstream exploded', { status: 502 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(fetchJson('https://example.com')).rejects.toMatchObject({
      message: 'HTTP 502 from upstream: upstream exploded',
    })
  })

  it('truncates long upstream body in ApiError message', async () => {
    const longBody = 'x'.repeat(600)
    const response = new Response(longBody, { status: 500 })
    const fetchMock = vi.fn().mockResolvedValue(response)
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(fetchJson('https://example.com')).rejects.toMatchObject({
      message: `HTTP 500 from upstream: ${'x'.repeat(500)}…`,
    })
  })

  it('throws UpstreamTimeoutError for aborts', async () => {
    const abortError = new DOMException('aborted', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    global.fetch = fetchMock as unknown as typeof fetch

    await expect(fetchJson('https://example.com')).rejects.toBeInstanceOf(UpstreamTimeoutError)
  })
})
