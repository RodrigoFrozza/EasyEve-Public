'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Activity, Loader2, Trash2, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import type { SocialContact } from './social-types'

interface ContactListItemProps {
  contact: SocialContact
  onRemove: () => void
  isRemoving: boolean
}

export function ContactListItem({ contact, onRemove, isRemoving }: ContactListItemProps) {
  const router = useRouter()
  const { t } = useTranslations()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const activityLabel = contact.activeActivity?.type
    ? t(`activity.types.${contact.activeActivity.type}` as 'activity.types.mining') ||
      contact.activeActivity.type
    : null

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          'flex items-center gap-3 rounded-sm border border-transparent p-2.5 transition-colors',
          'hover:border-eve-border/60 hover:bg-eve-dark/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-eve-accent',
          !contact.isOnline && 'opacity-75'
        )}
        onClick={() => router.push(`/players/${contact.id}`)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            router.push(`/players/${contact.id}`)
          }
        }}
      >
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10 rounded-sm border border-eve-border">
            <AvatarImage
              src={`https://images.evetech.net/characters/${contact.mainCharacterId}/portrait?size=64`}
            />
            <AvatarFallback className="rounded-sm bg-eve-dark text-eve-muted">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-eve-panel',
              contact.isOnline ? 'bg-emerald-500' : 'bg-eve-muted/50'
            )}
            aria-hidden
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'truncate text-sm font-semibold',
                contact.isOnline ? 'text-eve-text' : 'text-eve-muted'
              )}
            >
              {contact.name}
            </span>
            {contact.isOnline && contact.isTester && (
              <span className="shrink-0 rounded-sm border border-blue-500/30 bg-blue-500/10 px-1 py-0 text-[10px] font-medium text-blue-400">
                {t('common.beta')}
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-eve-muted">
            {contact.isOnline ? (
              activityLabel ? (
                <span className="inline-flex items-center gap-1 text-eve-accent">
                  <Activity className="h-3 w-3" />
                  {activityLabel}
                </span>
              ) : (
                <span className="text-emerald-500/80">{t('social.online')}</span>
              )
            ) : (
              t('social.offline')
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-eve-muted hover:bg-destructive/10 hover:text-destructive"
          aria-label={t('social.removeFriend')}
          disabled={isRemoving}
          onClick={(e) => {
            e.stopPropagation()
            setConfirmOpen(true)
          }}
        >
          {isRemoving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t('social.removeFriend')}</DialogTitle>
            <DialogDescription>
              {t('social.removeFriendConfirm', { name: contact.name })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isRemoving}
              onClick={() => {
                onRemove()
                setConfirmOpen(false)
              }}
            >
              {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
