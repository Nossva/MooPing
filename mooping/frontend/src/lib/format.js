// Formateo de fechas y valores tal como aparecen en el diseño.

export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '—'
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.round(h / 24)
  return `hace ${d} d`
}

export function capitalize(text) {
  return text ? text[0].toUpperCase() + text.slice(1) : text
}

export function todayLabel(orgName) {
  const date = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })
  return `${date}${orgName ? ` · ${orgName}` : ''}`.toUpperCase()
}

export function num(value, digits = 0) {
  if (value === null || value === undefined) return '—'
  return Number(value).toLocaleString('es-AR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function pct(value, digits = 0) {
  return value === null || value === undefined ? '—' : `${num(value, digits)}%`
}

// "Vaca #084" -> "#084"
export function shortTag(name) {
  const match = name?.match(/#\S+/)
  return match ? match[0] : name
}

// -34.2441 -> 34°14'38.9"S
export function dms(value, pos, neg) {
  if (value === null || value === undefined) return '—'
  const abs = Math.abs(value)
  const d = Math.floor(abs)
  const mFloat = (abs - d) * 60
  const m = Math.floor(mFloat)
  const s = ((mFloat - m) * 60).toFixed(1)
  return `${d}°${String(m).padStart(2, '0')}'${s.padStart(4, '0')}"${value >= 0 ? pos : neg}`
}

export function isoDate(daysFromToday = 0) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromToday)
  return d.toISOString().slice(0, 10)
}
