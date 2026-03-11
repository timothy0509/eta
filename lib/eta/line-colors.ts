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
