'use client'

import { useState } from 'react'
import { useSession } from '@/lib/session-client'
import { MessageSquare, X } from 'lucide-react'
import { useNotifications } from '@/lib/hooks/use-notifications'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { SocialPanel } from './SocialPanel'

export function FloatingSocialButton() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const [isOpen, setIsOpen] = useState(false)

  const { unreadCount, hasNewNotification, setHasNewNotification } = useNotifications()

  if (!session?.user) return null

  const userId = (session.user as { id?: string }).id ?? ''

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end gap-4">
      {isOpen && (
        <SocialPanel userId={userId} onClose={() => setIsOpen(false)} />
      )}

      <button
        type="button"
        className={cn(
          'relative flex h-14 w-14 items-center justify-center rounded-sm border transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent',
          isOpen
            ? 'border-eve-accent bg-eve-accent text-eve-dark'
            : 'border-eve-border bg-eve-panel/95 text-eve-accent shadow-lg backdrop-blur hover:border-eve-accent/50',
          hasNewNotification && !isOpen && 'border-red-500/70 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
        )}
        aria-label={isOpen ? t('common.close') : t('social.panelTitle')}
        aria-expanded={isOpen}
        onClick={() => {
          const next = !isOpen
          setIsOpen(next)
          if (next && hasNewNotification) setHasNewNotification(false)
        }}
      >
        {isOpen ? <X className="h-6 w-6" /> : <MessageSquare className="h-6 w-6" />}
        {!isOpen && unreadCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex min-h-[18px] min-w-[18px] items-center justify-center rounded-sm border-2 border-eve-panel bg-red-600 px-1 text-[10px] font-bold text-white"
            aria-live="polite"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
        <span
          className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-eve-panel bg-emerald-500"
          aria-hidden
        />
      </button>
    </div>
  )
}
