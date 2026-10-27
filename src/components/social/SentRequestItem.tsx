'use client'

import { Loader2, Trash2, User } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import type { SocialContact } from './social-types'

interface SentRequestItemProps {
  request: SocialContact
  onCancel: () => void
  isCancelling: boolean
}

export function SentRequestItem({ request, onCancel, isCancelling }: SentRequestItemProps) {
  const { t } = useTranslations()

  return (
    <div className="flex items-center gap-3 rounded-sm border border-eve-border/40 bg-eve-dark/20 p-3 opacity-90">
      <Avatar className="h-10 w-10 shrink-0 rounded-sm border border-eve-border grayscale">
        <AvatarImage
          src={`https://images.evetech.net/characters/${request.mainCharacterId}/portrait?size=64`}
        />
        <AvatarFallback className="rounded-sm bg-eve-dark text-eve-muted">
          <User className="h-5 w-5" />
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-eve-text">{request.name}</p>
        <p className="mt-0.5 text-xs text-eve-accent/80">{t('social.waiting')}</p>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-eve-muted hover:text-destructive"
        disabled={isCancelling}
        onClick={onCancel}
        aria-label={t('common.cancel')}
      >
        {isCancelling ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
        {t('common.cancel')}
      </Button>
    </div>
  )
}
