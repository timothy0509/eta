import type { Eta } from 'hk-bus-eta'

import { formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import type { MtrScheduleResponse, MtrTrainEntry } from '@/lib/eta/mtr'

export type SoonestIsoEta = {
  minutes: number | null
  arriving: boolean
  etaIso?: string
  dataTimestamp?: string
}

export function pickSoonestIsoEta(
  etas: Array<{ eta?: string; data_timestamp?: string }>,
  now: number | Date = new Date()
): SoonestIsoEta {
  const withEta = etas
    .filter((entry) => Boolean(entry.eta))
    .sort((a, b) => new Date(a.eta!).getTime() - new Date(b.eta!).getTime())

  const first = withEta[0]
  if (!first?.eta) {
    return { minutes: null, arriving: false }
  }

  const minutes = formatRelativeMinutesWithDrift(first.eta, first.data_timestamp, now)
  return {
    minutes,
    arriving: minutes <= 0,
    etaIso: first.eta,
    dataTimestamp: first.data_timestamp,
  }
}

export type SoonestMtrTrain = {
  minutes: number | null
  arriving: boolean
  train?: MtrTrainEntry
}

export function pickSoonestMtrTrain(
  schedule: MtrScheduleResponse | null | undefined,
  line: string,
  sta: string,
  downstreamStas: ReadonlySet<string>
): SoonestMtrTrain {
  if (!schedule?.data || downstreamStas.size === 0) {
    return { minutes: null, arriving: false }
  }

  const payload = schedule.data[`${line}-${sta}`]
  if (!payload) {
    return { minutes: null, arriving: false }
  }

  let best: { minutes: number; train: MtrTrainEntry } | null = null

  for (const dir of ['UP', 'DOWN'] as const) {
    for (const train of payload[dir] ?? []) {
      const dest = String(train.dest ?? '').trim()
      if (!dest || !downstreamStas.has(dest)) continue

      const raw = String(train.ttnt ?? '').trim()
      if (!raw) continue
      const minutes = Number(raw)
      if (Number.isNaN(minutes)) continue

      if (!best || minutes < best.minutes) {
        best = { minutes, train }
      }
    }
  }

  if (!best) {
    return { minutes: null, arriving: false }
  }

  return {
    minutes: best.minutes,
    arriving: best.minutes <= 0,
    train: best.train,
  }
}

export type EtaLike = Pick<Eta, 'eta'> & { data_timestamp?: string }
