'use client'

import { Bell } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import type { Notification } from '@/lib/hooks/use-notifications'
import {
  categorizeNotifications,
  type NotificationCategory,
} from './social-notification-utils'
import { NotificationItem } from './NotificationItem'

interface NotificationsPanelProps {
  notifications: Notification[]
  unreadCount: number
  onMarkAllRead: () => void
  onMarkRead: (id: string) => void
  onReviewRequests: () => void
  onOpenLink: (link: string) => void
}

const CATEGORY_KEYS: Record<NotificationCategory, string> = {
  social: 'social.notificationGroups.social',
  activity: 'social.notificationGroups.activity',
  system: 'social.notificationGroups.system',
}

export function NotificationsPanel({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkRead,
  onReviewRequests,
  onOpenLink,
}: NotificationsPanelProps) {
  const { t } = useTranslations()
  const grouped = categorizeNotifications(notifications)
  const hasAny = notifications.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-eve-border/50 px-4 py-2.5">
        <span className="text-sm font-medium text-eve-text">{t('social.notifications')}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs text-eve-accent hover:text-eve-accent"
          disabled={unreadCount === 0}
          onClick={onMarkAllRead}
        >
          {t('social.markAllRead')}
        </Button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-5 p-3">
          {!hasAny ? (
            <div className="flex flex-col items-center gap-3 py-16 text-eve-muted">
              <Bell className="h-10 w-10 opacity-30" />
              <p className="text-sm">{t('social.noNotifications')}</p>
            </div>
          ) : (
            (Object.keys(grouped) as NotificationCategory[]).map((category) => {
              const items = grouped[category]
              if (items.length === 0) return null

              return (
                <section key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-eve-muted">
                      {t(CATEGORY_KEYS[category] as 'social.notificationGroups.social')}
                    </span>
                    <div className="h-px flex-1 bg-eve-border/40" />
                  </div>
                  <div className="space-y-2">
                    {items.map(
                      (n) =>
                        n && (
                          <NotificationItem
                            key={n.id}
                            notification={n}
                            onMarkRead={onMarkRead}
                            onReviewRequests={onReviewRequests}
                            onOpenLink={onOpenLink}
                          />
                        )
                    )}
                  </div>
                </section>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
