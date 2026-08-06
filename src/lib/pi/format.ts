import type { PiPinBufferStatus } from '@/lib/pi/types'

/** Format PI production rates with at most one decimal place. */
export function formatPiRate(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (value === 0) return '0'

  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `${sign}${(abs / 1_000_000_000).toFixed(1)}B`
  }
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(1)}M`
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K`
  }
  if (abs >= 100) {
    return `${sign}${Math.round(abs).toLocaleString('en-US')}`
  }

  const rounded = Math.round(abs * 10) / 10
  return `${sign}${rounded.toLocaleString('en-US', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })}`
}

/** Human-readable countdown from simulated buffer hours. */
export function formatBufferCountdown(hours: number | undefined): string | null {
  if (hours == null || !Number.isFinite(hours)) return null
  if (hours <= 0) return '0m'

  if (hours < 1) {
    return `${Math.max(1, Math.round(hours * 60))}m`
  }
  if (hours < 48) {
    const wholeHours = Math.floor(hours)
    const minutes = Math.round((hours - wholeHours) * 60)
    if (minutes === 0) return `${wholeHours}h`
    if (wholeHours === 0) return `${minutes}m`
    return `${wholeHours}h ${minutes}m`
  }

  const days = Math.floor(hours / 24)
  const remHours = Math.round(hours % 24)
  if (remHours === 0) return `${days}d`
  return `${days}d ${remHours}h`
}

export type BufferCountdownKind = 'empty' | 'full'

export function pickBufferCountdown(input: {
  status: string
  timeToStopHrs?: number
  timeToFullHrs?: number
}): { kind: BufferCountdownKind; time: string } | null {
  const { status, timeToStopHrs, timeToFullHrs } = input

  if (status === 'stalled' || status === 'starving_soon') {
    const time = formatBufferCountdown(timeToStopHrs)
    return time != null ? { kind: 'empty', time } : null
  }

  if (status === 'full' || status === 'overflow_soon') {
    const time = formatBufferCountdown(timeToFullHrs)
    return time != null ? { kind: 'full', time } : null
  }

  const candidates: Array<{ kind: BufferCountdownKind; hours: number }> = []
  if (timeToStopHrs != null && Number.isFinite(timeToStopHrs)) {
    candidates.push({ kind: 'empty', hours: timeToStopHrs })
  }
  if (timeToFullHrs != null && Number.isFinite(timeToFullHrs)) {
    candidates.push({ kind: 'full', hours: timeToFullHrs })
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.hours - b.hours)
  const next = candidates[0]!
  const time = formatBufferCountdown(next.hours)
  return time != null ? { kind: next.kind, time } : null
}

/** Pick the most urgent fill/empty event across per-pin buffer statuses. */
export function pickUrgentPinCountdown(
  pinStatuses: PiPinBufferStatus[]
): { kind: BufferCountdownKind; time: string } | null {
  const candidates: Array<{ kind: BufferCountdownKind; hours: number }> = []

  for (const pin of pinStatuses) {
    if (pin.timeToEmptyHrs != null && Number.isFinite(pin.timeToEmptyHrs)) {
      candidates.push({ kind: 'empty', hours: pin.timeToEmptyHrs })
    }
    if (pin.timeToFullHrs != null && Number.isFinite(pin.timeToFullHrs)) {
      candidates.push({ kind: 'full', hours: pin.timeToFullHrs })
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => a.hours - b.hours)
  const next = candidates[0]!
  const time = formatBufferCountdown(next.hours)
  return time != null ? { kind: next.kind, time } : null
}
