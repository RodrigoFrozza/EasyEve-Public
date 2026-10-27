/**
 * Compact ISK formatting and chart axis helpers for the Performance panel.
 */

export function formatPerformanceValue(value: number): string {
  if (value == null || Number.isNaN(value)) return '0'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''

  if (abs >= 1_000_000_000) {
    const b = abs / 1_000_000_000
    return `${sign}${b >= 10 ? b.toFixed(0) : b.toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000
    return `${sign}${m >= 10 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  if (abs >= 1_000) {
    const k = abs / 1_000
    return `${sign}${k >= 10 ? k.toFixed(0) : k.toFixed(1)}K`
  }
  return `${sign}${Math.round(abs).toLocaleString()}`
}

function niceStep(rawStep: number): number {
  if (rawStep <= 0 || !Number.isFinite(rawStep)) return 1
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const normalized = rawStep / magnitude
  if (normalized <= 1) return magnitude
  if (normalized <= 2) return 2 * magnitude
  if (normalized <= 5) return 5 * magnitude
  return 10 * magnitude
}

/** Builds evenly spaced "nice" ticks from 0 through max (inclusive). */
export function buildChartTicks(maxValue: number, count = 5): number[] {
  if (maxValue <= 0 || !Number.isFinite(maxValue)) return [0]
  const step = niceStep(maxValue / Math.max(count - 1, 1))
  const ticks: number[] = []
  for (let v = 0; v <= maxValue + step * 0.001; v += step) {
    ticks.push(Math.round(v))
    if (ticks.length > count + 2) break
  }
  const last = ticks[ticks.length - 1]
  if (last < maxValue) {
    ticks.push(Math.ceil(maxValue / step) * step)
  }
  return [...new Set(ticks)].sort((a, b) => a - b)
}

export function formatPerformanceDate(dateStr: string, locale: string): string {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit' })
}
