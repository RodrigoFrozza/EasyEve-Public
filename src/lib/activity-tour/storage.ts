export type ActivityTourStatus = 'never_seen' | 'stopped' | 'completed'

export const ACTIVITY_TOUR_START_EVENT = 'easyeve:activity-tour-start'
export const ACTIVITY_TOUR_LAUNCH_ARM_EVENT = 'easyeve:activity-tour-launch-arm'
export const ACTIVITY_TOUR_LAUNCH_DISARM_EVENT = 'easyeve:activity-tour-launch-disarm'

function getUserScope(userId?: string | null): string {
  if (!userId || !userId.trim()) return 'anonymous'
  return userId
}

function getStatusKey(userId?: string | null): string {
  return `easyeve-activity-tour-status-${getUserScope(userId)}`
}

function getPendingKey(userId?: string | null): string {
  return `easyeve-activity-tour-pending-${getUserScope(userId)}`
}

export function getActivityTourStatus(userId?: string | null): ActivityTourStatus {
  if (typeof window === 'undefined') return 'never_seen'

  const raw = localStorage.getItem(getStatusKey(userId))
  if (raw === 'completed' || raw === 'stopped' || raw === 'never_seen') {
    return raw
  }

  return 'never_seen'
}

export function setActivityTourStatus(status: ActivityTourStatus, userId?: string | null): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(getStatusKey(userId), status)
}

export function isActivityTourPending(userId?: string | null): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(getPendingKey(userId)) === '1'
}

export function setActivityTourPending(pending: boolean, userId?: string | null): void {
  if (typeof window === 'undefined') return

  if (pending) {
    localStorage.setItem(getPendingKey(userId), '1')
    return
  }

  localStorage.removeItem(getPendingKey(userId))
}

export function isEligibleForFirstCharacterTour(characterCount?: number | null): boolean {
  return Number(characterCount) === 1
}
