'use client'

import { useLeaderboardStore, LeaderboardType } from '@/lib/stores/leaderboard-store'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Swords, Gem, MapPin } from 'lucide-react'
import {
  LeaderboardItem,
  PlayerTooltip,
  rankBadgeClass,
} from './leaderboard-utils'
const TYPE_ICONS: Record<LeaderboardType, typeof Swords> = {
  ratting: Swords,
  mining: Gem,
  exploration: MapPin,
}

interface LeaderboardCollapsedProps {
  data: LeaderboardItem[]
  currentUserId?: string
  type: string
}

export function LeaderboardCollapsed({ data, currentUserId, type }: LeaderboardCollapsedProps) {
  const { t } = useTranslations()
  const activeType = useLeaderboardStore((s) => s.activeType)
  const activePeriod = useLeaderboardStore((s) => s.activePeriod)
  const Icon = TYPE_ICONS[activeType]

  const items = (data || []).filter(Boolean).slice(0, 10)

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-1 py-4 text-center">
        <p className="text-[9px] leading-tight text-eve-muted">{t('dashboard.leaderboardEmptyTitle')}</p>
      </div>
    )
  }

  return (
      <div className="flex flex-col items-center gap-2 px-1 py-2 font-accent">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-sm border border-eve-accent/30 bg-eve-accent/5 text-eve-accent"
          title={
            activeType === 'ratting'
              ? t('dashboard.leaderboardTabRatting')
              : activeType === 'mining'
                ? t('dashboard.leaderboardTabMining')
                : t('dashboard.leaderboardTabExploration')
          }
        >
          <Icon className="h-4 w-4" />
        </div>
        <span className="max-w-[48px] truncate text-center text-[8px] font-medium uppercase tracking-wide text-eve-muted">
          {t(`dashboard.period.${activePeriod}`)}
        </span>
        <div className="my-1 h-px w-8 bg-eve-border/40" />
        {items.map((item, index) => {
          const rank = index + 1
          const isYou = item.userId === currentUserId
          return (
            <PlayerTooltip key={item.userId} item={item} rank={rank} type={type}>
              <div
                className={cn(
                  'relative cursor-help rounded-sm p-0.5 transition-colors',
                  isYou && 'ring-1 ring-eve-accent/40'
                )}
              >
                <Avatar
                  className={cn(
                    'h-9 w-9 rounded-sm border-2 bg-zinc-950',
                    rank === 1
                      ? 'border-amber-400'
                      : rank === 2
                        ? 'border-zinc-400'
                        : rank === 3
                          ? 'border-orange-500'
                          : 'border-eve-border/30'
                  )}
                >
                  <AvatarImage
                    src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`}
                    className="rounded-sm"
                  />
                  <AvatarFallback className="rounded-sm text-[9px]">
                    {item.characterName?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={cn(
                    'absolute -bottom-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-sm border px-0.5 text-[9px] font-bold',
                    rankBadgeClass(rank)
                  )}
                >
                  {rank}
                </span>
              </div>
            </PlayerTooltip>
          )
        })}
      </div>
  )
}
