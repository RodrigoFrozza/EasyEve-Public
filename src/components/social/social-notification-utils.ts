import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  Award,
  Bell,
  MessageSquare,
  UserPlus,
  Wallet,
} from 'lucide-react'
import type { Notification } from '@/lib/hooks/use-notifications'

export type NotificationCategory = 'social' | 'activity' | 'system'

const SOCIAL_TYPES = new Set(['friend_request', 'message'])
const ACTIVITY_KEYWORDS = ['activity', 'mining', 'ratting', 'paused', 'resumed', 'completed']

function isActivitySystemNotification(n: Notification): boolean {
  if (n.type !== 'system') return false
  const haystack = `${n.title} ${n.content}`.toLowerCase()
  return ACTIVITY_KEYWORDS.some((kw) => haystack.includes(kw))
}

export function getNotificationCategory(n: Notification): NotificationCategory {
  if (SOCIAL_TYPES.has(n.type)) return 'social'
  if (isActivitySystemNotification(n)) return 'activity'
  return 'system'
}

export function categorizeNotifications(
  notifications: Notification[]
): Record<NotificationCategory, Notification[]> {
  const groups: Record<NotificationCategory, Notification[]> = {
    social: [],
    activity: [],
    system: [],
  }

  for (const n of notifications) {
    if (!n) continue
    groups[getNotificationCategory(n)].push(n)
  }

  return groups
}

export function getNotificationIcon(type: string): LucideIcon {
  switch (type) {
    case 'friend_request':
      return UserPlus
    case 'message':
      return MessageSquare
    case 'medal':
      return Award
    case 'payment':
      return Wallet
    default:
      return isActivityType(type) ? Activity : Bell
  }
}

function isActivityType(type: string): boolean {
  return type === 'activity'
}

export type NotificationActionKind = 'review_requests' | 'open_link' | 'none'

export function getNotificationAction(n: Notification): NotificationActionKind {
  if (!n.isRead && n.type === 'friend_request') return 'review_requests'
  if (n.link) return 'open_link'
  return 'none'
}
