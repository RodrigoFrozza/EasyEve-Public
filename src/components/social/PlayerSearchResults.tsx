'use client'

import { Loader2, Search, User, X } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import type { PlayerSearchUser, SocialContact } from './social-types'

interface PlayerSearchResultsProps {
  debouncedSearch: string
  isSearching: boolean
  users: PlayerSearchUser[]
  contacts: SocialContact[]
  pendingSent: SocialContact[]
  onSendRequest: (userId: string) => void
  isPending: (id: string) => boolean
}

export function PlayerSearchResults({
  debouncedSearch,
  isSearching,
  users,
  contacts,
  pendingSent,
  onSendRequest,
  isPending,
}: PlayerSearchResultsProps) {
  const { t } = useTranslations()

  if (isSearching) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-eve-muted">
        <Loader2 className="h-8 w-8 animate-spin text-eve-accent" />
        <span className="text-sm">{t('common.loading')}</span>
      </div>
    )
  }

  if (debouncedSearch.length < 2) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-eve-muted">
        <Search className="h-10 w-10 opacity-30" />
        <p className="text-center text-sm">{t('social.searchMinChars')}</p>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-eve-muted">
        <X className="h-10 w-10 opacity-30" />
        <p className="text-sm">{t('social.searchNoResults')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {users.map((user) => {
        if (!user) return null
        const isLinked = contacts.some((c) => c?.contactId === user.id)
        const isSent = pendingSent.some((p) => p?.contactId === user.id)
        const sending = isPending(user.id)

        return (
          <div
            key={user.id}
            className="flex items-center gap-3 rounded-sm border border-eve-border/50 bg-eve-dark/30 p-3"
          >
            <Avatar className="h-10 w-10 shrink-0 rounded-sm border border-eve-border">
              <AvatarImage
                src={`https://images.evetech.net/characters/${user.mainCharacterId}/portrait?size=64`}
              />
              <AvatarFallback className="rounded-sm bg-eve-dark">
                <User className="h-5 w-5 text-eve-muted" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-eve-text">{user.name}</p>
            </div>
            {isLinked ? (
              <span className="text-xs font-medium text-emerald-500/90">{t('social.linked')}</span>
            ) : isSent ? (
              <span className="text-xs font-medium text-eve-accent/80">{t('social.requestSent')}</span>
            ) : (
              <Button
                type="button"
                size="sm"
                className="h-8 shrink-0"
                disabled={sending}
                onClick={() => onSendRequest(user.id)}
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t('social.sendRequest')}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
