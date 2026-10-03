import type { FavoritesItem } from '@/lib/store'

export type KmbGroupMember = Extract<
  FavoritesItem,
  { mode: 'kmb' } & ({ stopId: string } | { stopIds: string[] })
>

/**
 * Collect the viewable KMB members of a favorites group, in favorites order.
 * Keeps single-stop (`stopId`) and grouped (`stopIds`) members with their
 * saved filters (`route`/`entries`/`routeFilterMode`) intact. Skips contains
 * queries, saved routes (`type: 'route'`), MTR/LRT items, and members with
 * no usable stop ids.
 */
export function collectKmbGroupMembers(
  favorites: FavoritesItem[],
  groupId: string
): KmbGroupMember[] {
  const members: KmbGroupMember[] = []
  for (const item of favorites) {
    if (item.groupId !== groupId || item.mode !== 'kmb') continue
    if ('type' in item && item.type === 'route') continue
    if ('query' in item) continue
    if ('stopId' in item) {
      if (!item.stopId.trim()) continue
      members.push(item)
    } else if ('stopIds' in item) {
      if (!item.stopIds.some((id) => id.trim())) continue
      members.push(item)
    }
  }
  return members
}

/**
 * Build a stop-mode view item for a favorites group by unioning member stop ids.
 *
 * Ids are collected in member order, trimmed, deduped, and empties dropped.
 * Supports members with `stopId` or `stopIds`. Returns null when no usable
 * stop id remains.
 *
 * Per-member filters (`route`/`entries`) are intentionally dropped: the
 * stop-mode view shows every route serving the unioned stops under
 * `routeFilterMode: 'simple'`.
 *
 * The returned id (`kmb:group:<comma-joined-stop-ids>`) is stable for a given
 * stop set.
 */
export function buildGroupStopsItem(
  members: KmbGroupMember[],
  groupName: string
): FavoritesItem | null {
  const seen = new Set<string>()
  const stopIds: string[] = []
  for (const member of members) {
    const rawIds = 'stopId' in member ? [member.stopId] : member.stopIds
    for (const raw of rawIds) {
      const id = raw.trim()
      if (!id || seen.has(id)) continue
      seen.add(id)
      stopIds.push(id)
    }
  }
  if (stopIds.length === 0) return null
  return {
    id: `kmb:group:${stopIds.join(',')}`,
    mode: 'kmb',
    title: groupName,
    stopIds,
    routeFilterMode: 'simple',
  }
}
