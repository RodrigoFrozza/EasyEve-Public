'use client'

import { useMemo } from 'react'
import { formatISK } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { LeaderboardItem, PlayerTooltip, PodiumMedal } from './leaderboard-utils'

interface LeaderboardPodiumProps {
  data: LeaderboardItem[]
  currentUserId?: string
  type: string
}

export function LeaderboardPodium({ data, currentUserId, type }: LeaderboardPodiumProps) {
  const top3 = data.slice(0, 3)
  const podiumOrder = useMemo(() => {
    if (top3.length === 3) return [top3[1], top3[0], top3[2]]
    if (top3.length === 2) return [top3[1], top3[0]]
    return top3
  }, [top3])

  if (top3.length === 0) return null

  return (
    <div className="grid grid-cols-3 items-end gap-2 pb-2 pt-1">
      {podiumOrder.map((item) => {
        if (!item) return <div key="empty" />
        const rank = data.findIndex((d) => d.userId === item.userId) + 1
        const isFirst = rank === 1
        const isSecond = rank === 2
        const isThird = rank === 3
        const isYou = currentUserId === item.userId

        const height = isFirst ? 'h-[200px]' : isSecond ? 'h-[168px]' : 'h-[152px]'
        const podiumBg = isFirst
          ? 'border-amber-500/35 bg-gradient-to-t from-amber-950/40 to-eve-dark/80'
          : isSecond
            ? 'border-zinc-500/25 bg-gradient-to-t from-zinc-900/50 to-eve-dark/80'
            : 'border-orange-700/25 bg-gradient-to-t from-orange-950/30 to-eve-dark/80'

        return (
          <PlayerTooltip key={item.userId} item={item} rank={rank} type={type}>
            <div
              className={cn(
                'flex flex-col items-center rounded-sm border px-2 pb-3 pt-4 transition-transform motion-reduce:transition-none',
                height,
                podiumBg,
                isYou && 'ring-1 ring-eve-accent/50',
                'hover:motion-safe:-translate-y-0.5'
              )}
            >
              <div className="mb-2">
                <PodiumMedal rank={rank} />
              </div>
              <Avatar
                className={cn(
                  'rounded-sm border-2 bg-zinc-950',
                  isFirst ? 'h-14 w-14 border-amber-400' : 'h-11 w-11',
                  isSecond && 'border-zinc-400',
                  isThird && 'border-orange-500'
                )}
              >
                <AvatarImage
                  src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`}
                  className="rounded-sm"
                />
                <AvatarFallback className="rounded-sm text-xs font-bold">
                  {item.characterName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <p className="mt-2 w-full truncate text-center text-[11px] font-semibold text-eve-text">
                {item.characterName}
              </p>
              <p
                className={cn(
                  'mt-1 font-mono text-xs font-bold',
                  isFirst ? 'text-amber-400' : isSecond ? 'text-zinc-300' : 'text-orange-400'
                )}
              >
                {formatISK(item.total)}
              </p>
            </div>
          </PlayerTooltip>
        )
      })}
    </div>
  )
}
