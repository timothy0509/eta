'use client'

import * as React from 'react'

import { ArrowLeft, Clock, Loader2 } from 'lucide-react'
import type { Company } from 'hk-bus-eta'

import { EmptyState } from '@/components/eta/empty-state'
import { buildRouteFilterString } from '@/components/eta/panes/use-kmb-route-filter'
import { ResultsHeader } from '@/components/eta/results-header'
import { RouteDepartureRow, type StopChips } from '@/components/eta/results-kmb'
import { Button } from '@/components/ui/button'
import {
  fetchKmbRouteInfo,
  fetchKmbStopEtas,
  type KmbEtaEntryWithLeg,
  type KmbRouteInfoLite,
} from '@/lib/eta/client'
import { type KmbGroupMember } from '@/lib/eta/group-view'
import { useTranslations } from '@/lib/eta/i18n'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { parseCtbStopStreetCached } from '@/lib/eta/ctb-stop-street'
import { groupEtasByVariant } from '@/lib/eta/kmb-eta-groups'
import { usePaneStore } from '@/lib/eta/pane-store'
import { pickLang } from '@/lib/eta/pick-lang'
import { isKmbStop } from '@/lib/eta/types'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

type FaresByVariantKey = Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>

function memberStopIds(member: KmbGroupMember): string[] {
  if ('stopId' in member) {
    const stopId = member.stopId.trim()
    return stopId ? [stopId] : []
  }
  return member.stopIds.map((id) => id.trim()).filter((id) => id.length > 0)
}

/** Route filter string for one saved member, mirroring the KMB pane. */
function memberRouteFilter(member: KmbGroupMember): string | undefined {
  const mode = member.routeFilterMode ?? 'simple'
  const entries = (member.entries ?? []).map((entry, index) => ({
    id: `group-${member.id}-${index}`,
    variantKey: entry.variantKey,
  }))
  const route = 'route' in member ? member.route : undefined
  return buildRouteFilterString({ routes: route ?? '', entries }, mode, route)
}

/** Exact variant keys for advanced-mode members (client-side filter, like the pane). */
function memberVariantKeys(member: KmbGroupMember): Set<string> | null {
  const entries = member.entries ?? []
  return entries.length ? new Set(entries.map((entry) => entry.variantKey)) : null
}

function pickStopName(stop: KmbStopSearchItem | undefined, lang: UiLanguage): string | null {
  if (!stop) return null
  return pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
}

function buildStopChips(
  stopId: string,
  stop: KmbStopSearchItem | undefined,
  lang: UiLanguage
): StopChips {
  const fullName = pickStopName(stop, lang)
  const parsed = fullName
    ? parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
    : null
  return {
    stopId,
    fullName,
    name: parsed?.name ?? fullName ?? null,
    platform: parsed?.platform ?? null,
    stopCode: parsed?.stopCode ?? null,
    street: fullName ? parseCtbStopStreetCached(fullName) : null,
  }
}

function GroupMemberSection({
  member,
  lang,
  stopsById,
  refreshSeq,
  isFirst,
}: {
  member: KmbGroupMember
  lang: UiLanguage
  stopsById: Map<string, KmbStopSearchItem>
  refreshSeq: number
  isFirst?: boolean
}) {
  const { t } = useTranslations(lang)
  // Primitive effect keys: `stopIds` (array) and `variantKeys` (Set) get fresh
  // identities whenever the parent recomputes `member`, which would refire
  // the fetch effect on every parent render and abort each in-flight request.
  // Keying the effect on sorted strings keeps it stable across renders.
  const stopIdsKey = React.useMemo(() => memberStopIds(member).join(','), [member])
  const filterString = React.useMemo(() => memberRouteFilter(member), [member])
  const variantKeysKey = React.useMemo(() => {
    const keys = memberVariantKeys(member)
    return keys && keys.size > 0 ? Array.from(keys).sort().join(',') : null
  }, [member])
  const stopIds = React.useMemo(() => (stopIdsKey ? stopIdsKey.split(',') : []), [stopIdsKey])
  const [eta, setEta] = React.useState<KmbEtaEntryWithLeg[]>([])
  const [routeInfos, setRouteInfos] = React.useState<Record<string, KmbRouteInfoLite>>({})
  const [fares, setFares] = React.useState<FaresByVariantKey>({})
  const [loading, setLoading] = React.useState(stopIds.length > 0)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const [retrySeq, setRetrySeq] = React.useState(0)
  const fetchedInfoKeys = React.useRef(new Set<string>())

  React.useEffect(() => {
    if (stopIdsKey.length === 0) return
    const stopIds = stopIdsKey.split(',')
    const variantKeys = variantKeysKey ? new Set(variantKeysKey.split(',')) : null
    let cancelled = false
    const controller = new AbortController()
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchKmbStopEtas(stopIds, {
          routeFilter: filterString,
          signal: controller.signal,
          includeFares: true,
        })
        if (cancelled || controller.signal.aborted) return
        let etas = stopIds.flatMap((id) => result.byStopId[id] ?? [])
        if (variantKeys && variantKeys.size > 0) {
          etas = etas.filter((entry) => {
            const key = `${String(entry.co ?? 'kmb')}|${(entry.route ?? '').toUpperCase()}|${entry.dir}|${String(entry.service_type)}`
            return variantKeys.has(key)
          })
        }
        setEta(etas)
        setFares(result.faresByVariantKey ?? {})

        const missing = Array.from(
          new Set(
            etas.map(
              (entry) =>
                `${String(entry.co ?? 'kmb')}|${(entry.route ?? '').toUpperCase()}|${entry.dir}|${String(entry.service_type)}`
            )
          )
        )
          .filter((key) => !fetchedInfoKeys.current.has(key))
          .slice(0, 30)
        if (missing.length > 0) {
          const fetched = await Promise.allSettled(
            missing.map(async (key) => {
              const [co = 'kmb', route = '', direction = '', serviceType = ''] = key.split('|')
              const info = await fetchKmbRouteInfo({
                co: co as Company,
                route,
                direction,
                serviceType,
                signal: controller.signal,
              })
              return { key, info }
            })
          )
          if (cancelled || controller.signal.aborted) return
          const updates: Record<string, KmbRouteInfoLite> = {}
          for (const item of fetched) {
            if (item.status !== 'fulfilled') continue
            fetchedInfoKeys.current.add(item.value.key)
            updates[item.value.key] = item.value.info
          }
          if (Object.keys(updates).length) setRouteInfos((prev) => ({ ...prev, ...updates }))
        }
      } catch (err) {
        // Never surface aborts: effect cleanup (refresh/retry/unmount), the
        // timeout layer, and a dedupe-joined sibling aborting its own request
        // all reject with AbortError while this section's controller is live.
        // The surviving refresh completes silently; genuine errors still show.
        const isAbort =
          cancelled ||
          controller.signal.aborted ||
          (err instanceof DOMException && err.name === 'AbortError') ||
          (err instanceof Error && err.message.toLowerCase().includes('aborted'))
        if (isAbort) return
        setError(err instanceof Error ? err.message : 'Failed to load ETAs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [stopIdsKey, filterString, variantKeysKey, refreshSeq, retrySeq])

  const groups = React.useMemo(() => groupEtasByVariant(eta, fares), [eta, fares])

  const chipsByStopId = React.useMemo(() => {
    const next = new Map<string, StopChips>()
    for (const stopId of stopIds)
      next.set(stopId, buildStopChips(stopId, stopsById.get(stopId), lang))
    return next
  }, [stopIds, stopsById, lang])

  const headerName = React.useMemo(() => {
    if ('stopId' in member) {
      return pickStopName(stopsById.get(member.stopId), lang) ?? member.title
    }
    const first = member.stopIds.map((id) => stopsById.get(id)).find(Boolean)
    const name = pickStopName(first, lang)
    if (name) {
      return parseKmbStopNameCached(name, { isKmb: isKmbStop(first), lang }).name
    }
    return member.title
  }, [member, stopsById, lang])

  const suffix = React.useMemo(() => {
    if (member.routeFilterMode === 'advanced' && member.entries?.length) {
      const count = member.entries.length
      return ` · ${count} ${count === 1 ? t('kmb.routeSingular') : t('kmb.routes')}`
    }
    if ('route' in member && member.route) return ` · ${member.route}`
    return ''
  }, [member, t])

  return (
    <section
      aria-label={`${headerName}${suffix}`}
      className={cn(!isFirst && 'border-outline-variant mt-5 border-t pt-5')}
    >
      <div className="mb-2 flex items-center gap-2">
        <h3 className="text-on-surface m3-title-md min-w-0 flex-1 truncate">
          {headerName}
          {suffix}
        </h3>
      </div>

      {loading && eta.length === 0 ? (
        <div className="text-on-surface-variant m3-body-md flex items-center gap-2 py-4">
          <Loader2 className="ui-spin h-4 w-4" />
          {t('common.loading')}
        </div>
      ) : error && eta.length === 0 ? (
        <EmptyState
          title={error}
          action={
            <Button
              variant="secondary"
              size="sm"
              className="rounded-full"
              onClick={() => setRetrySeq((s) => s + 1)}
            >
              {t('common.tryAgain')}
            </Button>
          }
        />
      ) : groups.length === 0 ? (
        <EmptyState title={t('common.noScheduledBuses')} className="py-2" />
      ) : (
        <div className="space-y-2">
          {error ? (
            <p className="text-error m3-body-md" aria-live="polite">
              {error}
            </p>
          ) : null}
          {groups.map((group) => {
            const stopId = group.items[0]?.stop ? String(group.items[0].stop).trim() : null
            const chips =
              (stopId ? chipsByStopId.get(stopId) : undefined) ??
              buildStopChips(stopId ?? '', undefined, lang)
            return (
              <RouteDepartureRow
                key={group.key}
                variantKey={group.key}
                baseKey={group.baseKey}
                items={group.items}
                hasEta={group.hasEta}
                hasFare={group.hasFare}
                isArrivingLeg={group.isArrivingLeg}
                routeInfos={routeInfos}
                faresByVariantKey={fares}
                lang={lang}
                stopChips={chips}
                expanded={expandedKey === group.key}
                onToggleExpand={() =>
                  setExpandedKey((prev) => (prev === group.key ? null : group.key))
                }
              />
            )
          })}
        </div>
      )}
    </section>
  )
}

type Props = {
  lang: UiLanguage
  groupName: string
  members: KmbGroupMember[]
  onBack: () => void
  onOpenInStops?: () => void
}

export function GroupResultsKmb({ lang, groupName, members, onBack, onOpenInStops }: Props) {
  const { t } = useTranslations(lang)
  const kmbStops = usePaneStore((s) => s.kmbStops)
  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds)
  const [refreshSeq, setRefreshSeq] = React.useState(0)
  const bump = React.useCallback(() => setRefreshSeq((s) => s + 1), [])
  useAutoRefresh(autoRefreshSeconds * 1000, bump)

  const stopsById = React.useMemo(
    () => new Map(kmbStops.map((stop) => [stop.stopId, stop])),
    [kmbStops]
  )

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="ghost" size="sm" className="rounded-full" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-1.5">{t('common.back')}</span>
        </Button>
        {onOpenInStops && (
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={onOpenInStops}
            disabled={members.length === 0}
          >
            <span>{t('favorites.openInStops')}</span>
          </Button>
        )}
      </div>
      <ResultsHeader
        lang={lang}
        mode="kmb"
        title={groupName}
        icon={<Clock className="h-3.5 w-3.5 shrink-0" />}
        subtitle={`${members.length} ${t('kmb.stops')}`}
        onRefresh={bump}
      />

      {members.length === 0 ? (
        <EmptyState title={t('favorites.noStopsInGroup')} />
      ) : (
        <div>
          {members.map((member, index) => (
            <GroupMemberSection
              key={member.id}
              member={member}
              lang={lang}
              stopsById={stopsById}
              refreshSeq={refreshSeq}
              isFirst={index === 0}
            />
          ))}
        </div>
      )}
    </div>
  )
}
