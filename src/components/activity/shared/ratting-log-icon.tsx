'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AlertTriangle, TrendingDown } from 'lucide-react'

export type RattingLogType = 'bounty' | 'ess' | 'loot' | 'salvage' | 'mtu' | 'escalation' | 'expense'

const RATTING_MTU_ICON_URL = 'https://images.evetech.net/types/28748/icon?size=32'
const RATTING_LOOT_LOG_TYPES = new Set(['mtu', 'loot', 'loot-auto', 'salvage'])

export function isRattingLootLikeLog(type: string): boolean {
  return RATTING_LOOT_LOG_TYPES.has(type)
}

export function getRattingLogPortraitUrl(log: {
  type: string
  charId?: number
  characterId?: number
}): string | null {
  if (isRattingLootLikeLog(log.type)) return RATTING_MTU_ICON_URL
  if (log.type === 'escalation') return null
  if (log.type === 'expense') return null
  const charId = log.charId ?? log.characterId ?? 0
  if (charId > 0) {
    return `https://images.evetech.net/characters/${charId}/portrait?size=32`
  }
  return null
}

export function RattingLogIcon({
  log,
}: {
  log: { type: string; charId?: number; characterId?: number; charName?: string }
}) {
  if (log.type === 'escalation') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-orange-500/25 bg-orange-500/10">
        <AlertTriangle className="h-3.5 w-3.5 text-orange-300" />
      </div>
    )
  }

  if (log.type === 'expense') {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rose-500/25 bg-rose-500/10">
        <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
      </div>
    )
  }

  const iconUrl = getRattingLogPortraitUrl(log)
  if (iconUrl && isRattingLootLikeLog(log.type)) {
    return (
      <img
        src={iconUrl}
        alt=""
        className="h-6 w-6 shrink-0 rounded-md border border-red-500/15 bg-black/40 object-contain p-0.5"
      />
    )
  }

  return (
    <Avatar className="h-6 w-6 shrink-0 rounded-md border border-red-500/15">
      {iconUrl ? <AvatarImage src={iconUrl} className="rounded-md" /> : null}
      <AvatarFallback className="rounded-md bg-red-950/50 text-[6px] text-red-200/60">
        {log.charName?.[0] || '?'}
      </AvatarFallback>
    </Avatar>
  )
}

export const RATTING_LOG_TYPE_STYLES: Record<
  RattingLogType,
  { dot: string; label: string; amount: string }
> = {
  bounty: {
    dot: 'bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.6)]',
    label: 'text-red-200',
    amount: 'text-red-200',
  },
  ess: {
    dot: 'bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.5)]',
    label: 'text-amber-200/90',
    amount: 'text-amber-200',
  },
  loot: {
    dot: 'bg-rose-300 shadow-[0_0_6px_rgba(253,164,175,0.5)]',
    label: 'text-rose-200/90',
    amount: 'text-rose-200',
  },
  salvage: {
    dot: 'bg-orange-400/90 shadow-[0_0_6px_rgba(251,146,60,0.45)]',
    label: 'text-orange-200/85',
    amount: 'text-orange-200',
  },
  mtu: {
    dot: 'bg-red-300/80 shadow-[0_0_6px_rgba(252,165,165,0.45)]',
    label: 'text-red-200/80',
    amount: 'text-red-200/90',
  },
  escalation: {
    dot: 'bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.55)]',
    label: 'text-orange-200/90',
    amount: 'text-orange-200',
  },
  expense: {
    dot: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.55)]',
    label: 'text-rose-200/90',
    amount: 'text-rose-300',
  },
}

export function rattingLogTypeKey(type: string): RattingLogType {
  if (type === 'loot-auto') return 'loot'
  if (
    type === 'salvage' ||
    type === 'mtu' ||
    type === 'loot' ||
    type === 'ess' ||
    type === 'bounty' ||
    type === 'escalation' ||
    type === 'expense'
  ) {
    return type
  }
  return 'bounty'
}
