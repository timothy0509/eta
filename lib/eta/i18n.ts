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
  theme: { en: 'Theme', tc: '主題', sc: '主题' },
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
  details: { en: 'Details', tc: '詳情', sc: '详情' },
  now: { en: 'Now', tc: '即將到達', sc: '即将到达' },
  arriving: { en: 'Arriving', tc: '即將到達', sc: '即将到达' },
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
  systemTime: { en: 'System time', tc: '系統時間', sc: '系统时间' },
  selectStation: {
    en: 'Select a station to view trains.',
    tc: '選擇車站以查看班次',
    sc: '选择车站以查看班次',
  },
  routes: { en: 'routes', tc: '條路線', sc: '条路线' },
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
