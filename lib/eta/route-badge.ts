/**
 * Route badge styling by operator.
 */

export type RouteBadgeStyle = {
  textColor: string
  bgColor: string
}

const RE_KMB_NUM = /^[A-OQ-Z]?(\d+)/
const RE_CITYBUS_15 = /^15(?!\d)/
const RE_ANY_DIGITS = /(\d+)/

function getKmbRouteBadgeStyle(route: string): RouteBadgeStyle {
  const r = route.toUpperCase().trim()

  // Priority 1: Premium routes (P...)
  if (r.startsWith('P')) {
    return { textColor: '#FFFFFF', bgColor: '#CA856A' }
  }

  // Priority 2: Airport Night routes (NA...)
  if (r.startsWith('NA')) {
    return { textColor: '#FFFF00', bgColor: '#000000' }
  }

  // Priority 3: Overnight routes (N...)
  if (r.startsWith('N')) {
    return { textColor: '#FFFFFF', bgColor: '#000000' }
  }

  // Priority 4: Airport routes (A...)
  if (r.startsWith('A')) {
    return { textColor: '#FFFF00', bgColor: '#263576' }
  }

  // Priority 5: External/shuttle routes (E... or S...)
  if (r.startsWith('E') || r.startsWith('S')) {
    return { textColor: '#FFFFFF', bgColor: '#FFA500' }
  }

  // Priority 6: HK routes
  if (r.startsWith('HK')) {
    return { textColor: '#00AEEE', bgColor: '#FFFFFF' }
  }

  // Priority 7-8: Cross harbour / Western harbour
  // Match optional single letter prefix (except P which is Premium) followed by 3XX, 6XX, 9XX
  // Examples: 307, 603, 962, R603, X962
  const numMatch = r.match(RE_KMB_NUM)
  if (numMatch) {
    const num = parseInt(numMatch[1], 10)
    // 1XX, 3XX or 6XX: Cross harbour (red)
    if ((num >= 100 && num < 200) || (num >= 300 && num < 400) || (num >= 600 && num < 700)) {
      return { textColor: '#FFFFFF', bgColor: '#DC2626' }
    }
    // 9XX: Western harbour crossing (green)
    if (num >= 900 && num < 1000) {
      return { textColor: '#FFFFFF', bgColor: '#008000' }
    }
  }

  // Default: normal routes - black on white
  return { textColor: '#000000', bgColor: '#FFFFFF' }
}

function getCitybusRouteBadgeStyle(route: string): RouteBadgeStyle {
  const r = route.toUpperCase().trim()

  if (r === 'H1S') {
    return { textColor: '#FFFFFF', bgColor: '#714F2C' }
  }

  if (r === 'H1') {
    return { textColor: '#FFFFFF', bgColor: '#87BD42' }
  }

  if (r === 'H2K') {
    return { textColor: '#FFFFFF', bgColor: '#792888' }
  }

  if (r === 'H2') {
    return { textColor: '#FFFFFF', bgColor: '#DD1E5C' }
  }

  if (r === 'H3' || r === 'H4') {
    return { textColor: '#FFFFFF', bgColor: '#679AD1' }
  }

  if (r === 'R8') {
    return { textColor: '#213769', bgColor: '#9CC6E5' }
  }

  if (RE_CITYBUS_15.test(r)) {
    return { textColor: '#FFFFFF', bgColor: '#3CC3D9' }
  }

  if (r.startsWith('NA')) {
    return { textColor: '#FFFFFF', bgColor: '#BB2B44' }
  }

  if (r.startsWith('N')) {
    return { textColor: '#FFFF00', bgColor: '#000000' }
  }

  if (r.startsWith('A')) {
    return { textColor: '#FFFFFF', bgColor: '#BB2B44' }
  }

  if (r.startsWith('B')) {
    return { textColor: '#FFFFFF', bgColor: '#EF1C22' }
  }

  if (r.startsWith('E') && !r.startsWith('E11')) {
    return { textColor: '#FFFFFF', bgColor: '#DB3831' }
  }

  const numMatch = r.match(RE_ANY_DIGITS)
  const num = numMatch ? parseInt(numMatch[1], 10) : null
  const isWhc = r.startsWith('E11') || (num !== null && num >= 900 && num < 1000)

  if (isWhc) {
    return { textColor: '#FFFFFF', bgColor: '#009140' }
  }

  if (num !== null) {
    if ((num >= 100 && num < 200) || (num >= 600 && num < 700)) {
      return { textColor: '#FFFFFF', bgColor: '#FF0000' }
    }
  }

  return { textColor: '#FFFFFF', bgColor: '#0059BD' }
}

function getNlbRouteBadgeStyle(route: string): RouteBadgeStyle {
  const r = route.toUpperCase().trim()

  if (r === '1R') {
    return { textColor: '#FFFFFF', bgColor: '#885729' }
  }

  if (r === 'A35') {
    return { textColor: '#FFFFFF', bgColor: '#C4031C' }
  }

  if (r === 'X11R') {
    return { textColor: '#F8F801', bgColor: '#02027E' }
  }

  if (r.startsWith('N')) {
    return { textColor: '#FFFF00', bgColor: '#000000' }
  }

  return { textColor: '#FFFFFF', bgColor: '#02027E' }
}

export function getRouteBadgeStyle(route: string, company?: string): RouteBadgeStyle {
  const co = String(company ?? 'kmb').toLowerCase()

  if (co === 'kmb') {
    return getKmbRouteBadgeStyle(route)
  }

  if (co === 'ctb' || co === 'nwfb') {
    return getCitybusRouteBadgeStyle(route)
  }

  if (co === 'nlb') {
    return getNlbRouteBadgeStyle(route)
  }

  if (co === 'gmb') {
    return { textColor: '#000000', bgColor: '#CCFFCC' }
  }

  if (co === 'lrtfeeder') {
    return { textColor: '#0E2A51', bgColor: '#FFFFFF' }
  }

  return { textColor: '#000000', bgColor: '#FFFFFF' }
}
