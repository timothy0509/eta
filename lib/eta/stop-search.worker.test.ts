import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  StopSearchDoc,
  StopSearchWorkerEvent,
  StopSearchWorkerInit,
  StopSearchWorkerQuery,
} from '@/lib/eta/stop-search-pipeline'

type OutMessage = StopSearchWorkerEvent

const ctl = vi.hoisted(() => ({
  mode: 'real' as 'real' | 'reject-init' | 'manual',
  releaseInit: [] as Array<() => void>,
  throwQueries: new Set<string>(),
}))

vi.mock('./stop-search-pipeline', async (importOriginal) => {
  const real = await importOriginal<typeof import('./stop-search-pipeline')>()
  return {
    ...real,
    createStopSearchSession: (docs: import('./stop-search-pipeline').StopSearchDoc[]) => {
      if (ctl.mode === 'reject-init') return Promise.reject(new Error('fuse chunk failed'))
      if (ctl.mode === 'manual') {
        return new Promise<import('./stop-search-pipeline').StopSearchSession>((resolve) => {
          ctl.releaseInit.push(() =>
            resolve({
              search: (rawQuery: string) => {
                if (ctl.throwQueries.has(rawQuery.trim().toLowerCase())) {
                  throw new Error('search boom')
                }
                return real.searchStopGroups(docs, null, rawQuery)
              },
            })
          )
        })
      }
      return real.createStopSearchSession(docs)
    },
  }
})

function doc(stopId: string, nameEn: string, stopCode: string | null): StopSearchDoc {
  const baseName = nameEn
  return {
    stopId,
    baseName,
    stopCode,
    displaySecondary: nameEn,
    displayName: baseName,
    searchName: baseName.toLowerCase(),
    searchSecondary: baseName.toLowerCase(),
    searchCode: (stopCode ?? '').toLowerCase(),
    normalized: `${baseName}|${stopCode ?? ''}`.toLowerCase(),
    stop: {
      stopId,
      nameEn,
      nameTc: nameEn,
      nameSc: nameEn,
      lat: 22.3,
      lng: 114.2,
      isKmb: true,
    },
  } as StopSearchDoc
}

const DOCS = [
  doc('A1', 'Abc Central Station', 'AB001'),
  doc('A2', 'Abc East Station', 'AB002'),
  doc('B1', 'Xyz Terminal', null),
]

type Scope = {
  postMessage: (msg: OutMessage) => void
  onmessage: ((event: MessageEvent<StopSearchWorkerInit | StopSearchWorkerQuery>) => void) | null
}

async function loadWorker() {
  await import('./stop-search.worker')
  const scope = self as unknown as Scope
  if (!scope.onmessage) throw new Error('worker did not install onmessage')
  return scope
}

function flush(times = 10): Promise<void> {
  let chain = Promise.resolve()
  for (let i = 0; i < times; i += 1) {
    chain = chain.then(() => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  return chain
}

describe('stop-search worker protocol', () => {
  let posted: OutMessage[]
  let scope: Scope

  beforeEach(async () => {
    ctl.mode = 'real'
    ctl.releaseInit = []
    ctl.throwQueries = new Set()
    scope = await loadWorker()
    posted = []
    scope.postMessage = (msg) => {
      posted.push(msg)
    }
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function send(msg: StopSearchWorkerInit | StopSearchWorkerQuery): void {
    scope.onmessage?.({ data: msg } as MessageEvent<StopSearchWorkerInit | StopSearchWorkerQuery>)
  }

  it('echoes session, id and query on results and ignores stale sessions', async () => {
    send({ type: 'init', session: 1, docs: DOCS })
    await flush()
    send({ type: 'search', session: 1, id: 1, query: 'abc' })
    await flush()
    const first = posted.filter((m) => m.id === 1)
    expect(first).toHaveLength(1)
    expect(first[0]?.session).toBe(1)
    expect(first[0]?.query).toBe('abc')
    expect(first[0]?.groups.length).toBeGreaterThan(0)

    // Stale session never answers.
    send({ type: 'search', session: 99, id: 2, query: 'abc' })
    await flush()
    expect(posted.some((m) => m.id === 2)).toBe(false)

    // A new session answers again.
    send({ type: 'init', session: 2, docs: DOCS })
    await flush()
    send({ type: 'search', session: 2, id: 3, query: 'xyz' })
    await flush()
    const third = posted.filter((m) => m.id === 3)
    expect(third).toHaveLength(1)
    expect(third[0]?.groups[0]?.displayName).toBe('Xyz Terminal')
  })

  it('collapses keystrokes queued while the session builds', async () => {
    ctl.mode = 'manual'
    send({ type: 'init', session: 3, docs: DOCS })
    // Session not ready: both queue, only the newest survives.
    send({ type: 'search', session: 3, id: 10, query: 'abc' })
    send({ type: 'search', session: 3, id: 11, query: 'xyz' })
    await flush()
    expect(posted).toHaveLength(0)
    for (const release of ctl.releaseInit.splice(0)) release()
    await flush()
    expect(posted.map((m) => m.id)).toEqual([11])
    expect(posted[0]?.groups[0]?.displayName).toBe('Xyz Terminal')
  })

  it('answers with prefix-only results when the Fuse chunk fails to load', async () => {
    ctl.mode = 'reject-init'
    send({ type: 'init', session: 5, docs: DOCS })
    await flush()
    send({ type: 'search', session: 5, id: 5, query: 'abc' })
    await flush()
    expect(posted).toHaveLength(1)
    // Prefix-only fallback: the exact/prefix 'abc' rows, no fuzzy extras.
    const names = posted[0]?.groups.map((g) => g.displayName) ?? []
    expect(names).toContain('Abc Central Station')
    expect(names).not.toContain('Xyz Terminal')
    // A later search on the same session still answers.
    send({ type: 'search', session: 5, id: 6, query: 'xyz' })
    await flush()
    expect(posted.map((m) => m.id)).toEqual([5, 6])
  })

  it('answers with prefix-only results when a search throws', async () => {
    ctl.mode = 'manual'
    ctl.throwQueries.add('boom')
    send({ type: 'init', session: 7, docs: DOCS })
    for (const release of ctl.releaseInit.splice(0)) release()
    await flush()
    send({ type: 'search', session: 7, id: 7, query: 'boom' })
    await flush()
    // 'boom' matches nothing by prefix, so the fallback is empty — but the
    // UI gets an answer and stops waiting instead of hanging dimmed.
    expect(posted.map((m) => m.id)).toEqual([7])
    expect(posted[0]?.groups).toEqual([])
  })
})
