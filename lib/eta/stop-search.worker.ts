// Stop-search web worker: runs the pure pipeline from
// `./stop-search-pipeline` off the main thread so typing stays
// responsive. Ranking and results are byte-identical to the
// main-thread fallback because both call the same functions.

import type {
  StopGroup,
  StopSearchWorkerEvent,
  StopSearchWorkerInit,
  StopSearchWorkerQuery,
} from './stop-search-pipeline'
import { createStopSearchSession } from './stop-search-pipeline'

const scope = self as unknown as {
  postMessage: (msg: StopSearchWorkerEvent) => void
  onmessage: ((event: MessageEvent<StopSearchWorkerInit | StopSearchWorkerQuery>) => void) | null
}

let activeSession = 0
let search: ((rawQuery: string) => StopGroup[]) | null = null
/** Collapsed to the newest entry: only the latest query matters. */
const pending: StopSearchWorkerQuery[] = []
let running = false

function pump(): void {
  if (running || !search) return
  const next = pending.pop()
  pending.length = 0
  if (!next || next.session !== activeSession) return
  running = true
  try {
    const groups = search(next.query)
    if (next.session === activeSession) {
      scope.postMessage({
        type: 'results',
        session: next.session,
        id: next.id,
        query: next.query,
        groups,
      })
    }
  } finally {
    running = false
    // A newer query may have landed while this one ran; answer only it.
    if (pending.length > 0) pump()
  }
}

scope.onmessage = (event: MessageEvent<StopSearchWorkerInit | StopSearchWorkerQuery>) => {
  const msg = event.data
  if (msg.type === 'init') {
    activeSession = msg.session
    search = null
    pending.length = 0
    const docs = msg.docs
    const session = msg.session
    void createStopSearchSession(docs).then((created) => {
      if (session !== activeSession) return
      search = created.search
      pump()
    })
    return
  }
  if (msg.session !== activeSession) return
  // Collapse the backlog: intermediate keystrokes are superseded.
  pending.length = 0
  pending.push(msg)
  pump()
}
