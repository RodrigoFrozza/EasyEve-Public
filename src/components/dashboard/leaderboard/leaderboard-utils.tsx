'use client'

import { formatISK } from '@/lib/utils'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { FormattedNumber } from '@/components/shared/FormattedNumber'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import * as Tooltip from '@radix-ui/react-tooltip'

export interface LeaderboardItem {
  userId: string
  total: number
  label1?: number
  label2?: number
  characterName: string
  characterId: number
}

export function getCountdown(period: string): string {
  const now = new Date()
  if (period === 'alltime') return 'N/A'

  let target: Date
  switch (period) {
    case 'daily':
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
      break
    case 'weekly': {
      const day = now.getUTCDay()
      const diffToMonday = day === 0 ? 1 : 8 - day
      target = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday)
      )
      break
    }
    case 'monthly':
      target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
      break
    default:
      return '--'
  }

  const diff = Math.floor((target.getTime() - now.getTime()) / 1000)
  if (diff <= 0) return 'Resetting...'

  const days = Math.floor(diff / 86400)
  const hours = Math.floor((diff % 86400) / 3600)
  const mins = Math.floor((diff % 3600) / 60)

  if (days > 0) return `${days}d ${hours}h ${mins}m`
  return `${hours}h ${mins}m ${diff % 60}s`
}

export function rankBadgeClass(rank: number): string {
  if (rank === 1) return 'border-amber-500/40 bg-amber-500/10 text-amber-400'
  if (rank === 2) return 'border-zinc-400/40 bg-zinc-400/10 text-zinc-300'
  if (rank === 3) return 'border-orange-600/40 bg-orange-600/10 text-orange-400'
  return 'border-eve-border/30 bg-zinc-950 text-zinc-500'
}

export function PlayerTooltip({
  item,
  rank,
  type,
  children,
}: {
  item: LeaderboardItem
  rank: number
  type: string
  children: React.ReactNode
}) {
  const { t } = useTranslations()
  if (!item) return <>{children}</>

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side="left" align="center" sideOffset={8} className="z-50">
          <div className="w-64 rounded-sm border border-eve-border/60 bg-[#04090e]/95 p-4 font-accent shadow-lg backdrop-blur-md">
            <div className="mb-3 flex items-center gap-3 border-b border-eve-border/20 pb-3">
              <Avatar className="h-10 w-10 rounded-sm border border-eve-border/40 bg-black">
                <AvatarImage
                  src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`}
                  className="rounded-sm"
                />
                <AvatarFallback className="rounded-sm bg-zinc-950 text-zinc-600">
                  {item.characterName?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <h4 className="truncate text-sm font-semibold text-white">{item.characterName}</h4>
                <p className="text-xs text-eve-accent">#{rank}</p>
              </div>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Total</span>
                <span className="font-mono font-semibold text-white">{formatISK(item.total)}</span>
              </div>
              {type === 'ratting' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Bounty</span>
                    <span className="font-mono text-zinc-400">{formatISK(item.label1 || 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">ESS</span>
                    <span className="font-mono text-zinc-400">{formatISK(item.label2 || 0)}</span>
                  </div>
                </>
              )}
              {type === 'mining' && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Volume</span>
                  <span className="font-mono text-zinc-400">
                    <FormattedNumber value={item.label1 || 0} suffix=" m³" />
                  </span>
                </div>
              )}
              {type === 'exploration' && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Systems</span>
                  <span className="font-mono text-zinc-400">
                    <FormattedNumber value={item.label1 || 0} />
                  </span>
                </div>
              )}
            </div>
            <Link
              href={`/players/${item.userId}`}
              className="mt-3 flex items-center gap-1 text-xs text-eve-accent hover:text-white"
            >
              {t('dashboard.viewProfile')} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <Tooltip.Arrow className="fill-eve-border/60" />
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

export function PodiumMedal({ rank }: { rank: number }) {
  if (rank > 3) {
    return (
      <span className="rounded-sm border border-eve-border/20 bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
        #{rank}
      </span>
    )
  }
  const styles = [
    'border-amber-400/60 bg-amber-500/15 text-amber-400',
    'border-zinc-400/50 bg-zinc-400/10 text-zinc-300',
    'border-orange-500/50 bg-orange-600/10 text-orange-400',
  ]
  return (
    <span
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-sm border text-xs font-bold',
        styles[rank - 1]
      )}
    >
      {rank}
    </span>
  )
}
