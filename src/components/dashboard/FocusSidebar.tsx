'use client'

import type React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { UTCClock } from '@/components/dashboard/UTCClock'
import { CharactersCompact } from '@/components/dashboard/CharactersCompact'
import { UserSearch } from '@/components/dashboard/UserSearch'
import { useFocusSidebarStore } from '@/lib/stores/focus-sidebar-store'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Plus,
  RefreshCw,
  User,
  Users,
  Globe,
} from 'lucide-react'

interface FocusCharacter {
  id: number
  name: string
  isMain: boolean
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
}

interface FocusSidebarProps {
  userId: string
  mainCharacterId?: number
  mainCharacterName?: string
  characters: FocusCharacter[]
}

function CollapsedAction({
  label,
  onClick,
  href,
  icon: Icon,
  onExpand,
}: {
  label: string
  onClick?: () => void
  href?: string
  icon: React.FC<{ className?: string }>
  onExpand?: () => void
}) {
  const inner = (
    <button
      type="button"
      onClick={() => {
        onExpand?.()
        onClick?.()
      }}
      className="flex h-10 w-10 items-center justify-center rounded-sm border border-transparent text-eve-muted transition-colors hover:border-eve-border hover:bg-eve-dark hover:text-eve-accent"
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </button>
  )

  const linkInner = href ? (
    <Link
      href={href}
      className="flex h-10 w-10 items-center justify-center rounded-sm border border-transparent text-eve-muted transition-colors hover:border-eve-border hover:bg-eve-dark hover:text-eve-accent"
      aria-label={label}
    >
      <Icon className="h-4 w-4" />
    </Link>
  ) : (
    inner
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{linkInner}</TooltipTrigger>
      <TooltipContent side="right" className="font-accent text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function FocusSidebar({
  userId,
  mainCharacterId,
  mainCharacterName,
  characters,
}: FocusSidebarProps) {
  const router = useRouter()
  const { t } = useTranslations()
  const isCollapsed = useFocusSidebarStore((s) => s.isCollapsed)
  const setCollapsed = useFocusSidebarStore((s) => s.setCollapsed)

  const expand = () => setCollapsed(false)

  if (isCollapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <div className="flex flex-col items-center gap-1 py-2 font-accent max-lg:flex-row max-lg:flex-wrap max-lg:justify-center max-lg:gap-2 max-lg:px-2 max-lg:py-3">
          {mainCharacterId ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={expand}
                  className="mb-1 rounded-sm border border-eve-border/40 p-0.5 transition-colors hover:border-eve-accent/40"
                  aria-label={mainCharacterName || t('dashboard.pilotFocus')}
                >
                  <Avatar className="h-10 w-10 rounded-sm bg-eve-dark">
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${mainCharacterId}/portrait?size=128`}
                      className="rounded-sm object-cover"
                    />
                    <AvatarFallback className="rounded-sm bg-eve-dark text-eve-muted">
                      {mainCharacterName?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">{mainCharacterName}</TooltipContent>
            </Tooltip>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex h-10 w-10 items-center justify-center text-eve-muted">
                <Globe className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">
              <UTCClock />
            </TooltipContent>
          </Tooltip>

          <CollapsedAction
            label={t('dashboard.myCharacters')}
            href="/dashboard/characters"
            icon={Users}
          />
          <UserSearch variant="icon" />
          <CollapsedAction
            label={t('dashboard.commands.startActivity')}
            icon={Plus}
            onClick={() => router.push('/dashboard/activity')}
          />
          <CollapsedAction
            label={t('dashboard.commands.syncEsi')}
            icon={RefreshCw}
            onClick={() => router.push('/dashboard/activity')}
          />
          <CollapsedAction
            label={t('dashboard.commands.profile')}
            href={`/players/${userId}`}
            icon={User}
          />
        </div>
      </TooltipProvider>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-3 font-accent">
      {mainCharacterId && mainCharacterName ? (
        <div className="flex items-center gap-3 border-b border-eve-border/30 pb-3">
          <Avatar className="h-12 w-12 shrink-0 rounded-sm border border-eve-border bg-eve-dark">
            <AvatarImage
              src={`https://images.evetech.net/characters/${mainCharacterId}/portrait?size=128`}
              className="rounded-sm object-cover"
            />
            <AvatarFallback className="rounded-sm bg-eve-dark text-eve-muted">
              {mainCharacterName[0] || '?'}
            </AvatarFallback>
          </Avatar>
          <p className="min-w-0 truncate text-sm font-semibold text-eve-text">{mainCharacterName}</p>
        </div>
      ) : null}

      <UTCClock />

      <CharactersCompact characters={characters} mainCharacterId={mainCharacterId} />

      <UserSearch className="w-full" />

      <div className="flex flex-col gap-2 border-t border-eve-border/30 pt-3">
        <Button
          variant="eve"
          className="h-9 w-full text-xs"
          onClick={() => router.push('/dashboard/activity')}
        >
          <Plus className="mr-2 h-3.5 w-3.5" />
          {t('dashboard.commands.startActivity')}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-eve-border text-xs text-eve-muted hover:text-eve-text"
            onClick={() => router.push('/dashboard/activity')}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('dashboard.commands.syncEsi')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 border-eve-border text-xs text-eve-muted hover:text-eve-text"
            asChild
          >
            <Link href={`/players/${userId}`}>
              <User className="mr-1.5 h-3.5 w-3.5" />
              {t('dashboard.commands.profile')}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
