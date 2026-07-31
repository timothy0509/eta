import type { UiLanguage } from '@/lib/eta/types'

export const MTR_LINE_COLORS: Record<string, string> = {
  AEL: '#00888F',
  EAL: '#53B7E8',
  KTL: '#00A040',
  TWL: '#E60012',
  ISL: '#007DC5',
  TCL: '#F77700',
  TKL: '#744DA9',
  TML: '#A35A00',
  DRL: '#EB6EA5',
  SIL: '#CBCD00',
}

export const MTR_LINE_NAMES: Record<string, { en: string; tc: string; sc: string }> = {
  AEL: { en: 'Airport Express', tc: '機場快線', sc: '机场快线' },
  TCL: { en: 'Tung Chung Line', tc: '東涌線', sc: '东涌线' },
  TML: { en: 'Tuen Ma Line', tc: '屯馬線', sc: '屯马线' },
  TKL: { en: 'Tseung Kwan O Line', tc: '將軍澳線', sc: '将军澳线' },
  EAL: { en: 'East Rail Line', tc: '東鐵線', sc: '东铁线' },
  SIL: { en: 'South Island Line', tc: '南港島線', sc: '南港岛线' },
  TWL: { en: 'Tsuen Wan Line', tc: '荃灣線', sc: '荃湾线' },
  ISL: { en: 'Island Line', tc: '港島線', sc: '港岛线' },
  KTL: { en: 'Kwun Tong Line', tc: '觀塘線', sc: '观塘线' },
  DRL: { en: 'Disneyland Resort Line', tc: '迪士尼線', sc: '迪士尼线' },
}

export function getMtrLineName(code: string, lang: UiLanguage): string {
  const entry = MTR_LINE_NAMES[code]
  if (!entry) return code
  if (lang === 'en') return entry.en
  if (lang === 'sc') return entry.sc
  return entry.tc
}

// Light Rail (route_no) colors
export const LRT_ROUTE_COLORS: Record<string, string> = {
  '505': '#da2128', // Red
  '507': '#25a650', // Green
  '507P': '#25a650', // Green
  '610': '#551b14', // Brown
  '614': '#44c0f3', // Light Blue
  '614P': '#f4858d', // Pink
  '615': '#f9dd07', // Yellow
  '615P': '#256684', // Dark Blue
  '705': '#72bf44', // Light Green
  '706': '#b27ab4', // Purple
  '751': '#f5821f', // Orange
  '761P': '#6f2b91', // Dark Purple
}

export function getLineColor(code: string | null | undefined, fallback = '#64748b') {
  if (!code) return fallback
  return MTR_LINE_COLORS[code] ?? LRT_ROUTE_COLORS[code] ?? fallback
}
