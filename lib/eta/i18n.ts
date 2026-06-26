import * as React from 'react'
import type { UiLanguage } from '@/lib/eta/types'

// ============================================================================
// Centralized translation dictionary
// ============================================================================

type TranslationEntry = {
  en: string
  tc: string
  sc: string
}

const common: Record<string, TranslationEntry> = {
  saved: { en: 'Saved', tc: '已儲存', sc: '已储存' },
  settings: { en: 'Settings', tc: '設定', sc: '设定' },
  routes: { en: 'Routes', tc: '路線', sc: '路线' },
  stops: { en: 'Stops', tc: '車站', sc: '车站' },
  nearby: { en: 'Nearby', tc: '附近', sc: '附近' },
  theme: { en: 'Theme', tc: '主題', sc: '主题' },
  appearance: { en: 'Appearance', tc: '外觀', sc: '外观' },
  language: { en: 'Language', tc: '語言', sc: '语言' },
  autoRefresh: { en: 'Auto Refresh', tc: '自動刷新', sc: '自动刷新' },
  themeLight: { en: 'Light', tc: '淺色', sc: '浅色' },
  themeDark: { en: 'Dark', tc: '深色', sc: '深色' },
  themeSystem: { en: 'System', tc: '系統', sc: '系统' },
  off: { en: 'Off', tc: '關閉', sc: '关闭' },
  toggleTheme: { en: 'Toggle theme', tc: '切換主題', sc: '切换主题' },
  refresh: { en: 'Refresh', tc: '重新整理', sc: '重新整理' },
  save: { en: 'Save', tc: '收藏', sc: '收藏' },
  selectStop: {
    en: 'Select a stop to load ETAs.',
    tc: '選擇車站以載入到站時間',
    sc: '选择车站以载入到站时间',
  },
  noScheduledBuses: { en: 'No scheduled buses', tc: '暫時沒有預定班次', sc: '暂时没有预定班次' },
  stale: { en: 'Stale', tc: '未更新', sc: '未更新' },
  routeDetails: { en: 'Route details', tc: '路線詳情', sc: '路线详情' },
  routeAndStopDetails: { en: 'Route and stop details', tc: '路線及車站詳情', sc: '路线及车站详情' },
  stop: { en: 'Stop', tc: '車站', sc: '车站' },
  operator: { en: 'Operator', tc: '營辦商', sc: '营办商' },
  route: { en: 'Route', tc: '路線', sc: '路线' },
  fare: { en: 'Fare', tc: '車費', sc: '车费' },
  unknown: { en: 'Unknown', tc: '未知', sc: '未知' },
  mapUnavailable: {
    en: 'Map unavailable for this mode',
    tc: '此地圖模式不適用',
    sc: '此地图模式不适用',
  },
  details: { en: 'Details', tc: '詳情', sc: '详情' },
  now: { en: 'Now', tc: '即將到達', sc: '即将到达' },
  arriving: { en: 'Arriving', tc: '即將到達', sc: '即将到达' },
  back: { en: 'Back', tc: '返回', sc: '返回' },
  map: { en: 'Map', tc: '地圖', sc: '地图' },
  desc: {
    en: 'Clean, fast ETAs for Hong Kong transit.',
    tc: '簡潔又快速的香港交通到站預報。',
    sc: '简洁又快速的香港交通到站预报。',
  },
  searchPin: {
    en: 'Search and pin your go-to stops.',
    tc: '搜尋並釘選常用車站。',
    sc: '搜索并钉选常用车站。',
  },
  refreshLocation: { en: 'Refresh location', tc: '重新整理位置', sc: '重新整理位置' },
  locating: { en: 'Locating…', tc: '正在定位…', sc: '正在定位…' },
  locationError: { en: 'Location error', tc: '定位失敗', sc: '定位失败' },
  noStopsNearby: {
    en: 'No stops found nearby.',
    tc: '附近沒有找到車站。',
    sc: '附近没有找到车站。',
  },
  nearbyStops: { en: 'Nearby stops', tc: '附近車站', sc: '附近车站' },
  distance: { en: 'Distance', tc: '距離', sc: '距离' },
  mtrNoCoords: {
    en: 'MTR stations are not geolocated. Showing all stations grouped by line.',
    tc: '港鐵車站沒有地理座標，現按路線顯示所有車站。',
    sc: '港铁车站没有地理坐标，现按路线显示所有车站。',
  },
  lrtNoCoords: {
    en: 'Light Rail stations are not geolocated. Showing all route stations.',
    tc: '輕鐵車站沒有地理座標，現顯示各路線車站。',
    sc: '轻铁车站没有地理坐标，现显示各路线车站。',
  },
  allMtrLines: { en: 'All MTR lines', tc: '所有港鐵路線', sc: '所有港铁路线' },
  allLrtRoutes: { en: 'All Light Rail routes', tc: '所有輕鐵路線', sc: '所有轻铁路线' },
  loading: { en: 'Loading…', tc: '載入中…', sc: '载入中…' },
  viewEtas: { en: 'View ETAs', tc: '查看到站時間', sc: '查看到站时间' },
}

const kmb: Record<string, TranslationEntry> = {
  title: { en: 'Bus ETAs', tc: '巴士到站預報', sc: '巴士到站预报' },
  allRoutesAtStop: { en: 'All routes at this stop', tc: '此站所有路線', sc: '此站所有路线' },
  filtered: { en: 'Filtered:', tc: '篩選:', sc: '筛选:' },
  stopsLoaded: { en: 'stops loaded', tc: '個車站', sc: '个车站' },
  loadingMoreStops: {
    en: 'Loading more stops...',
    tc: '正在載入更多車站...',
    sc: '正在载入更多车站...',
  },
  allStopsLoaded: {
    en: 'All {count} stops loaded',
    tc: '已載入全部 {count} 個车站',
    sc: '已载入全部 {count} 个车站',
  },
  updateFailed: {
    en: 'Update failed. Showing last results. ({error})',
    tc: '更新失敗。顯示上次結果。({error})',
    sc: '更新失败。显示上次结果。({error})',
  },
  updated: { en: 'Updated {time}', tc: '更新 {time}', sc: '更新 {time}' },
  routeFilter: { en: 'Route Filter', tc: '路線篩選', sc: '路线筛选' },
  stops: { en: 'stops', tc: '個車站', sc: '个车站' },
  routeStops: { en: 'route-stops', tc: '個路線車站', sc: '个路线车站' },
  selectedStops: { en: 'Selected stops', tc: '已選車站', sc: '已选车站' },
  bus: { en: 'Bus', tc: '巴士', sc: '巴士' },
  routes: { en: 'routes', tc: '條路線', sc: '条路线' },
  routeSingular: { en: 'route', tc: '條路線', sc: '条路线' },
}

const mtr: Record<string, TranslationEntry> = {
  title: { en: 'MTR', tc: '港鐵', sc: '港铁' },
  lines: { en: 'Lines', tc: '路線', sc: '路线' },
  stations: { en: 'Stations', tc: '車站', sc: '车站' },
  nextTrain: { en: 'Next Train', tc: '下班車', sc: '下班车' },
  selectStation: {
    en: 'Select a station to view trains.',
    tc: '選擇車站以查看班次',
    sc: '选择车站以查看班次',
  },
  serviceMessage: { en: 'Service message', tc: '服務信息', sc: '服务信息' },
  viewDetails: { en: 'View details', tc: '查看詳情', sc: '查看详情' },
  up: { en: 'UP', tc: '上行', sc: '上行' },
  down: { en: 'DOWN', tc: '下行', sc: '下行' },
  viaRacecourse: { en: ' · Via Racecourse', tc: ' · 經馬場', sc: ' · 经马场' },
}

const lrt: Record<string, TranslationEntry> = {
  title: { en: 'Light Rail', tc: '輕鐵', sc: '轻铁' },
  stations: { en: 'Stations', tc: '車站', sc: '车站' },
  systemTime: { en: 'System time', tc: '系統時間', sc: '系统时间' },
  selectStation: {
    en: 'Select a station to view trains.',
    tc: '選擇車站以查看班次',
    sc: '选择车站以查看班次',
  },
  routes: { en: 'routes', tc: '條路線', sc: '条路线' },
}

const favorites: Record<string, TranslationEntry> = {
  saved: { en: 'Saved', tc: '已儲存', sc: '已储存' },
  favorites: { en: 'Favorites', tc: '收藏', sc: '收藏' },
  recent: { en: 'Recent', tc: '最近', sc: '最近' },
  noFavorites: { en: 'No favorites yet.', tc: '暫無收藏。', sc: '暂无收藏。' },
  tip: {
    en: 'Results can auto-refresh while you wait.',
    tc: '結果可在等待時自動刷新。',
    sc: '结果可在等待时自动刷新。',
  },
  clear: { en: 'Clear', tc: '清除', sc: '清除' },
  noRecent: { en: 'No recent searches.', tc: '暫無搜尋記錄。', sc: '暂无搜索记录。' },
  pinned: { en: 'Pinned', tc: '已釘選', sc: '已钉选' },
  unpinned: { en: 'Unpinned', tc: '取消釘選', sc: '取消钉选' },
  moveUp: { en: 'Move up', tc: '上移', sc: '上移' },
  moveDown: { en: 'Move down', tc: '下移', sc: '下移' },
  group: { en: 'Group', tc: '分組', sc: '分组' },
  groups: { en: 'Groups', tc: '分組', sc: '分组' },
  addGroup: { en: 'Add group', tc: '新增分組', sc: '新增分组' },
  rename: { en: 'Rename', tc: '重新命名', sc: '重新命名' },
  delete: { en: 'Delete', tc: '刪除', sc: '删除' },
  none: { en: 'None', tc: '無', sc: '无' },
  remove: { en: 'Remove favorite', tc: '移除收藏', sc: '移除收藏' },
}

const errors: Record<string, TranslationEntry> = {
  noResults: { en: 'No results.', tc: '無結果。', sc: '无结果。' },
  updateFailedGeneric: { en: 'Update failed', tc: '更新失敗', sc: '更新失败' },
}

export const translations = {
  common,
  kmb,
  mtr,
  lrt,
  favorites,
  errors,
}

// ============================================================================
// Translation hook
// ============================================================================

export function useTranslations(lang: UiLanguage) {
  const t = React.useCallback(
    (key: string): string => {
      const parts = key.split('.')
      const category = parts[0]
      const entryKey = parts.slice(1).join('.')

      const categoryMap = (translations as Record<string, Record<string, TranslationEntry>>)[
        category
      ]
      if (!categoryMap) return key

      const entry = categoryMap[entryKey]
      if (!entry) return key

      return entry[lang] ?? entry.tc
    },
    [lang]
  )

  const tWithParams = React.useCallback(
    (key: string, params: Record<string, string | number>): string => {
      let result = t(key)
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(`{${paramKey}}`, String(paramValue))
      }
      return result
    },
    [t]
  )

  return { t, tWithParams }
}
