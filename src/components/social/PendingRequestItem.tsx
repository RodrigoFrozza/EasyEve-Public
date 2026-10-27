'use client'

import { Check, Loader2, User, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import type { SocialContact } from './social-types'

interface PendingRequestItemProps {
  request: SocialContact
  onAccept: () => void
  onReject: () => void
  isAccepting: boolean
  isRejecting: boolean
}

export function PendingRequestItem({
  request,
  onAccept,
  onReject,
  isAccepting,
  isRejecting,
}: PendingRequestItemProps) {
  const { t } = useTranslations()
  const busy = isAccepting || isRejecting

  return (
    <div className="flex items-center gap-3 rounded-sm border border-eve-border/50 bg-eve-dark/30 p-3">
      <Avatar className="h-10 w-10 shrink-0 rounded-sm border border-eve-border">
        <AvatarImage
          src={`https://images.evetech.net/characters/${request.mainCharacterId}/portrait?size=64`}
        />
        <AvatarFallback className="rounded-sm bg-eve-dark text-eve-muted">
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-eve-text">{request.name}</p>
        <p className="mt-0.5 text-xs text-eve-muted">{t('social.friendRequest')}</p>
      </div>

      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1 bg-emerald-600/90 text-white hover:bg-emerald-600"
          disabled={busy}
          onClick={onAccept}
        >
          {isAccepting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {t('social.accept')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1 border-eve-border text-eve-muted hover:border-destructive/50 hover:text-destructive"
          disabled={busy}
          onClick={onReject}
        >
          {isRejecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          {t('social.reject')}
        </Button>
      </div>
    </div>
  )
}
