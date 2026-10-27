/**
 * Pure helper for the Industry Jobs dashboard: turn a millisecond delta (job
 * end_date - now) into a short human string. Negative/zero deltas (job already
 * finished, ESI status hasn't caught up yet, or the row itself says `ready`)
 * render as "ready" rather than a negative duration.
 */
export function formatRelativeTime(ms: number): string {
  if (!Number.isFinite(ms)) return '—'
  if (ms <= 0) return 'ready'

  const totalMinutes = Math.floor(ms / 60000)
  const days = Math.floor(totalMinutes / (60 * 24))
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return '<1m'
}
