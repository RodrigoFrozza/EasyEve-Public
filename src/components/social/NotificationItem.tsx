'use client'

import type { MouseEvent } from 'react'
import { Clock } from 'lucide-react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { Notification } from '@/lib/hooks/use-notifications'
import {
  getNotificationAction,
  getNotificationIcon,
} from './social-notification-utils'

interface NotificationItemProps {
  notification: Notification
  onMarkRead: (id: string) => void
  onReviewRequests: () => void
  onOpenLink: (link: string) => void
}

export function NotificationItem({
  notification,
  onMarkRead,
  onReviewRequests,
  onOpenLink,
}: NotificationItemProps) {
  const { t } = useTranslations()
  const Icon = getNotificationIcon(notification.type)
  const action = getNotificationAction(notification)

  const handleClick = () => {
    if (!notification.isRead) onMarkRead(notification.id)
  }

  const handleAction = (e: MouseEvent) => {
    e.stopPropagation()
    if (!notification.isRead) onMarkRead(notification.id)

    if (action === 'review_requests') {
      onReviewRequests()
    } else if (action === 'open_link' && notification.link) {
      onOpenLink(notification.link)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'flex gap-3 rounded-sm border p-3 transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent',
        notification.isRead
          ? 'border-eve-border/30 bg-eve-dark/20 opacity-80'
          : 'border-eve-border/60 border-l-2 border-l-eve-accent bg-eve-dark/50'
      )}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border',
          notification.isRead
            ? 'border-eve-border/40 bg-eve-dark text-eve-muted'
            : 'border-eve-accent/30 bg-eve-accent/10 text-eve-accent'
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm font-semibold leading-snug',
              notification.isRead ? 'text-eve-muted' : 'text-eve-text'
            )}
          >
            {notification.title}
          </p>
          {!notification.isRead && (
            <span
              className="mt-1 h-2 w-2 shrink-0 rounded-full bg-eve-accent"
              aria-hidden
            />
          )}
        </div>
        {notification.content && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-eve-muted">
            {notification.content}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-eve-muted/80">
            <Clock className="h-3 w-3" />
            <FormattedDate date={notification.createdAt} />
          </span>
          {action !== 'none' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs text-eve-accent hover:text-eve-accent"
              onClick={handleAction}
            >
              {action === 'review_requests' ? t('social.reviewRequest') : t('social.open')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
