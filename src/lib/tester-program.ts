import { ACTIVITY_TYPES } from '@/lib/constants/activity-data'

export const TESTER_APPLICATION_COOLDOWN_DAYS = 14

export const TESTER_PROGRAM_RULES = [
  'Participate in the EasyEve Discord server.',
  'Keep logging in and testing your EasyEve account regularly.',
  'Report adjustments or issues in Discord whenever possible.',
  'Believe EasyEve can become a real differential for EVE players.',
] as const

export const FULL_ACTIVITY_ACCESS = ACTIVITY_TYPES.map((activity) => activity.id)

export function getTesterCooldownUntil(from: Date = new Date()): Date {
  const cooldown = new Date(from)
  cooldown.setDate(cooldown.getDate() + TESTER_APPLICATION_COOLDOWN_DAYS)
  return cooldown
}
