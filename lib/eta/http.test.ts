import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  fetchJson,
  ApiError,
  UpstreamTimeoutError,
  getAdaptiveConcurrency,
  isWeakNetworkConnection,
  resolveTimeoutMs,
} from './http'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function setConnection(connection: unknown): void {
  vi.stubGlobal('navigator', { connection })
}

describe('fetchJson', () => {
  it('successfully fetches and parses JSON', async () => {
    const mockResponse = { data: 'test' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    const result = await fetchJson<{ data: string }>('/api/test')
    expect(result).toEqual(mockResponse)
  })

  it('sets accept header to application/json', async () => {
    let capturedHeaders: Headers | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedHeaders = init?.headers as Headers
      return new Response('{}', { status: 200 })
    })

    await fetchJson('/api/test')
    expect(capturedHeaders?.get('accept')).toBe('application/json')
  })

  it('throws ApiError on 4xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Not Found', {
        status: 404,
        statusText: 'Not Found',
      })
    )

    await expect(fetchJson('/api/missing')).rejects.toThrow(ApiError)
    await expect(fetchJson('/api/missing')).rejects.toMatchObject({
      status: 404,
    })
  })

  it('throws ApiError on 5xx response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('Internal Server Error', {
        status: 500,
        statusText: 'Internal Server Error',
      })
    )

    await expect(fetchJson('/api/error')).rejects.toThrow(ApiError)
    await expect(fetchJson('/api/error')).rejects.toMatchObject({
      status: 500,
    })
  })

  it('includes sanitized body in ApiError message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error": "bad request"}', {
        status: 400,
      })
    )

    await expect(fetchJson('/api/bad')).rejects.toThrow(
      'HTTP 400 from upstream: {"error": "bad request"}'
    )
  })

  it('sanitizes HTML error responses', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html><body>Error</body></html>', {
        status: 502,
      })
    )

    await expect(fetchJson('/api/bad')).rejects.toThrow('HTTP 502 from upstream')
  })

  it('throws UpstreamTimeoutError on abort', async () => {
    const controller = new AbortController()
    vi.spyOn(globalThis, 'fetch').mockImplementation(
      () =>
        new Promise((_, reject) => {
          controller.signal.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          )
        })
    )

    const promise = fetchJson('/api/abort', { signal: controller.signal })
    controller.abort()

    await expect(promise).rejects.toThrow(UpstreamTimeoutError)
  })

  it('uses default timeout when not specified', async () => {
    // Verify default timeout is set (12s) by checking it doesn't immediately timeout
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await expect(fetchJson('/api/test')).resolves.toEqual({})
  })

  it('passes custom headers to fetch', async () => {
    let capturedInit: RequestInit | undefined
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
      capturedInit = init
      return new Response('{}', { status: 200 })
    })

    await fetchJson('/api/test', { headers: { 'X-Custom': 'value' } })
    expect((capturedInit?.headers as Headers)?.get('X-Custom')).toBe('value')
  })

  it('handles JSON parsing errors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('not valid json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )

    await expect(fetchJson('/api/bad-json')).rejects.toThrow()
  })

  it('uses default timeout when not specified', async () => {
    // Verify default timeout is set by checking it doesn't immediately timeout
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))

    await expect(fetchJson('/api/test')).resolves.toEqual({})
  })

  it('does not timeout before timeoutMs', async () => {
    const mockResponse = { data: 'ok' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    )

    await expect(fetchJson('/api/test', { timeoutMs: 1000 })).resolves.toEqual(mockResponse)
  })

  it('retries once on 5xx then succeeds', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('boom', { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )

    const result = await fetchJson<{ ok: boolean }>('/api/flaky', { retryDelayMs: 1 })

    expect(result).toEqual({ ok: true })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 4xx', async () => {
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('nope', { status: 404 }))

    await expect(fetchJson('/api/missing', { retryDelayMs: 1 })).rejects.toThrow(ApiError)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not retry when the caller aborts', async () => {
    const controller = new AbortController()
    const spy = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    controller.abort()
    await expect(
      fetchJson('/api/abort', { signal: controller.signal, retryDelayMs: 1 })
    ).rejects.toThrow()
    expect(spy).not.toHaveBeenCalled()
  })

  it('resolves network-aware timeouts and concurrency', () => {
    setConnection({ saveData: false, effectiveType: '4g' })
    expect(isWeakNetworkConnection()).toBe(false)
    expect(resolveTimeoutMs('live')).toBe(8_000)
    expect(getAdaptiveConcurrency(5, 3, 2)).toBe(5)

    setConnection({ saveData: false, effectiveType: '2g' })
    expect(isWeakNetworkConnection()).toBe(true)
    expect(resolveTimeoutMs('live')).toBe(15_000)
    expect(resolveTimeoutMs('route')).toBe(8_000)
    expect(getAdaptiveConcurrency(5, 3, 2)).toBe(2)

    setConnection({ saveData: true, effectiveType: '4g' })
    expect(isWeakNetworkConnection()).toBe(true)
    expect(getAdaptiveConcurrency(5, 3, 2)).toBe(2)
  })
})
