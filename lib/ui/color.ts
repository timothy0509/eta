type Rgb = { r: number; g: number; b: number }

function clampByte(value: number) {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function parseHexColor(hex: string): Rgb | null {
  const cleaned = hex.replace('#', '').trim()
  if (cleaned.length === 3) {
    const r = Number.parseInt(cleaned[0] + cleaned[0], 16)
    const g = Number.parseInt(cleaned[1] + cleaned[1], 16)
    const b = Number.parseInt(cleaned[2] + cleaned[2], 16)
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
    return { r, g, b }
  }
  if (cleaned.length !== 6) return null
  const r = Number.parseInt(cleaned.slice(0, 2), 16)
  const g = Number.parseInt(cleaned.slice(2, 4), 16)
  const b = Number.parseInt(cleaned.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return { r, g, b }
}

function getYiqLuma(color: Rgb) {
  const r = clampByte(color.r)
  const g = clampByte(color.g)
  const b = clampByte(color.b)
  return (r * 299 + g * 587 + b * 114) / 1000
}

export function getReadableForeground(hexColor: string) {
  const color = parseHexColor(hexColor)
  if (!color) return 'text-white'
  return getYiqLuma(color) >= 160 ? 'text-black' : 'text-white'
}
