import type { UiLanguage } from '@/lib/eta/types'
import type { TransportMode } from '@/lib/store'

export function getHeading(mode: TransportMode, lang: UiLanguage) {
  return mode === 'kmb'
    ? lang === 'en'
      ? 'Bus ETAs'
      : lang === 'sc'
        ? '巴士到站预报'
        : '巴士到站預報'
    : mode === 'mtr'
      ? lang === 'en'
        ? 'MTR Next Train'
        : lang === 'sc'
          ? '港铁下班车'
          : '港鐵下班車'
      : lang === 'en'
        ? 'Light Rail'
        : '輕鐵'
}

export function getTranslations(lang: UiLanguage) {
  return {
    desc:
      lang === 'en'
        ? 'Clean, fast ETAs for Hong Kong transit.'
        : lang === 'sc'
          ? '簡潔又快速的香港交通到站預報。'
          : '簡潔又快速的香港交通到站預報。',
    theme: lang === 'en' ? 'Theme' : lang === 'sc' ? '主题' : '主題',
    searchPin:
      lang === 'en'
        ? 'Search and pin your go-to stops.'
        : lang === 'sc'
          ? '搜尋並釘選常用車站。'
          : '搜尋並釘選常用車站。',
    kmbTitle: lang === 'en' ? 'Bus ETAs' : lang === 'sc' ? '巴士到站预报' : '巴士到站預報',
    mtrTitle: lang === 'en' ? 'MTR' : lang === 'sc' ? '港铁' : '港鐵',
    lrtTitle: lang === 'en' ? 'Light Rail' : '輕鐵',
    saved: lang === 'en' ? 'Saved' : lang === 'sc' ? '已储存' : '已儲存',
    toggleTheme: lang === 'en' ? 'Toggle theme' : lang === 'sc' ? '切换主题' : '切換主題',
  }
}
