export type PromisePoolResult<T> =
  { status: 'fulfilled'; value: T } | { status: 'rejected'; reason: unknown }

export async function promisePool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  options?: { signal?: AbortSignal }
): Promise<Array<PromisePoolResult<R>>> {
  const limit = Math.max(1, concurrency)
  const results: Array<PromisePoolResult<R>> = new Array(items.length)

  let nextIndex = 0

  const runners = new Array(Math.min(limit, items.length)).fill(null).map(async () => {
    while (true) {
      if (options?.signal?.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      const currentIndex = nextIndex
      nextIndex += 1
      if (currentIndex >= items.length) return

      try {
        const value = await worker(items[currentIndex])
        results[currentIndex] = { status: 'fulfilled', value }
      } catch (reason) {
        results[currentIndex] = { status: 'rejected', reason }
      }
    }
  })

  await Promise.all(runners).catch((error) => {
    const reason =
      error instanceof DOMException && error.name === 'AbortError'
        ? error
        : new DOMException('The operation was aborted.', 'AbortError')
    for (let i = 0; i < results.length; i += 1) {
      const slot: PromisePoolResult<R> | undefined = results[i]
      if (slot === undefined) {
        results[i] = { status: 'rejected', reason }
      }
    }
    throw error
  })
  return results
}
