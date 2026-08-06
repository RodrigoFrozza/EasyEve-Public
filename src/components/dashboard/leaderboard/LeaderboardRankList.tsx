'use client'

import { useState } from 'react'
import { formatISK } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { ChevronLeft, ChevronRight, TrendingUp } from 'lucide-react'
import { LeaderboardItem, PlayerTooltip } from './leaderboard-utils'

interface LeaderboardRankListProps {
  data: LeaderboardItem[]
  currentUserId?: string
  type: string
  userRank?: number
}

export function LeaderboardRankList({
  data,
  currentUserId,
  type,
  userRank,
}: LeaderboardRankListProps) {
  const { t } = useTranslations()
  const [page, setPage] = useState(0)
  const itemsPerPage = 7

  const remaining = data.slice(3)
  const paginated = remaining.slice(page * itemsPerPage, (page + 1) * itemsPerPage)
  const totalPages = Math.ceil(remaining.length / itemsPerPage) || 1
  const leaderTotal = data[0]?.total || 0

  const positionFromData = currentUserId
    ? data.findIndex((i) => i?.userId === currentUserId) + 1
    : 0
  const displayRank =
    positionFromData > 0 ? positionFromData : userRank && userRank > 0 ? userRank : 0
  const userRow = currentUserId ? data.find((i) => i?.userId === currentUserId) : undefined
  const showStickyRank = displayRank > 3

  return (
      <div className="flex flex-col font-accent">
        {remaining.length > 0 && (
          <ul className="space-y-1.5">
            {paginated.map((item, index) => {
              if (!item) return null
              const rank = 3 + page * itemsPerPage + index + 1
              const isYou = currentUserId === item.userId
              const pct = leaderTotal > 0 ? (item.total / leaderTotal) * 100 : 0

              return (
                <li key={item.userId}>
                  <PlayerTooltip item={item} rank={rank} type={type}>
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-sm border px-2 py-2 transition-colors',
                        isYou
                          ? 'border-eve-accent/35 bg-eve-accent/5'
                          : 'border-eve-border/20 bg-eve-dark/40 hover:border-eve-border/40'
                      )}
                    >
                      <span
                        className={cn(
                          'w-6 shrink-0 text-center text-[11px] font-bold tabular-nums',
                          isYou ? 'text-eve-accent' : 'text-eve-muted'
                        )}
                      >
                        {rank}
                      </span>
                      <Avatar className="h-8 w-8 shrink-0 rounded-sm border border-eve-border/30">
                        <AvatarImage
                          src={`https://images.evetech.net/characters/${item.characterId}/portrait?size=64`}
                          className="rounded-sm"
                        />
                        <AvatarFallback className="rounded-sm text-[9px]">
                          {item.characterName?.[0] || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'truncate text-xs font-medium',
                              isYou ? 'text-eve-text' : 'text-eve-muted'
                            )}
                          >
                            {item.characterName}
                          </p>
                          <p className="shrink-0 font-mono text-[11px] font-semibold text-eve-text">
                            {formatISK(item.total)}
                          </p>
                        </div>
                        <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/50">
                          <div
                            className={cn(
                              'h-full rounded-full',
                              isYou ? 'bg-eve-accent' : 'bg-eve-border'
                            )}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </PlayerTooltip>
                </li>
              )
            })}
          </ul>
        )}

        {showStickyRank && (
          <div className="sticky bottom-0 z-10 mt-3 flex items-center justify-between rounded-sm border border-eve-accent/25 bg-eve-panel/95 px-3 py-2.5 shadow-[0_-4px_12px_rgba(0,0,0,0.4)] backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-eve-accent" />
              <div>
                <p className="text-[10px] text-eve-muted">{t('dashboard.yourPosition')}</p>
                <p className="text-sm font-bold text-eve-text">#{displayRank}</p>
              </div>
            </div>
            {userRow ? (
              <span className="font-mono text-xs font-semibold text-eve-accent">
                {formatISK(userRow.total)}
              </span>
            ) : (
              <span className="text-[10px] text-eve-muted">{t('dashboard.outsideTopLeaderboard')}</span>
            )}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-sm border border-eve-border/30 p-1.5 disabled:opacity-30"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4 text-eve-muted" />
            </button>
            <span className="text-[11px] text-eve-muted">
              {page + 1} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-sm border border-eve-border/30 p-1.5 disabled:opacity-30"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4 text-eve-muted" />
            </button>
          </div>
        )}
      </div>
  )
}
