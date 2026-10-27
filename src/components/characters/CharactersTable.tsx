'use client'

import { useMemo, useState } from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { MapPin, Ship } from 'lucide-react'
import { CharacterListRowMenu } from './CharacterListRowMenu'
import { CharacterTableTags } from './CharacterTableTags'
import { formatISK, formatSP, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useCorporationInfo } from '@/lib/hooks/use-corporation-info'
import {
  characterIsStale,
  characterTokenInvalid,
} from '@/lib/characters/character-status-accent'
import { CHARACTER_TAG_TRANSLATION_KEYS } from '@/constants/character-tags'
import type { CharacterListItem } from '@/types/character'

export type CharactersGroupBy = 'flat' | 'byRole'

const GRID =
  'grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.8fr)_40px]'

type SortField = 'name' | 'walletBalance' | 'totalSp'
type SortOrder = 'asc' | 'desc'

/** Role buckets for the "By role" grouping, matched in priority order. */
const ROLE_BUCKETS: { tag: string; color: string }[] = [
  { tag: 'Miner', color: '#34b3a4' },
  { tag: 'Ratter', color: '#e0a94a' },
  { tag: 'Hauler', color: '#6ea8fe' },
  { tag: 'Explorer', color: '#6ea8fe' },
  { tag: 'Abyssal Runner', color: '#a98bfa' },
  { tag: 'PvPer', color: '#f47272' },
]

function statusDot(char: CharacterListItem): { color: string; title?: string } {
  if (characterTokenInvalid({ tokenExpiresAt: char.tokenExpiresAt })) {
    return { color: '#f47272', title: 'Token expired' }
  }
  if (characterIsStale({ lastFetchedAt: char.lastFetchedAt })) {
    return { color: '#e0a94a', title: 'Stale data' }
  }
  return { color: '#5a6b7a' }
}

function CharacterRow({
  character,
  accountCode,
  dotBorder,
}: {
  character: CharacterListItem
  accountCode: string
  dotBorder: string
}) {
  const { t } = useTranslations()
  const { data: corpInfo } = useCorporationInfo(character.corporationId)
  const dot = statusDot(character)
  const stale = characterIsStale({ lastFetchedAt: character.lastFetchedAt })
  const tokenInvalid = characterTokenInvalid({ tokenExpiresAt: character.tokenExpiresAt })

  const corpLine = corpInfo?.ticker
    ? `[${corpInfo.ticker}]${corpInfo.name ? ` ${corpInfo.name}` : ''}`
    : corpInfo?.name || ''

  return (
    <div
      className={cn(
        'grid items-center gap-[14px] border-b border-white/[0.04] px-[18px] py-[11px] transition-colors hover:bg-ta-row-hover',
        GRID
      )}
    >
      {/* Character identity */}
      <div className="flex min-w-0 items-center gap-[11px]">
        <div className="relative shrink-0">
          <Avatar className="h-[34px] w-[34px] rounded-[8px] border border-white/10">
            <AvatarImage
              src={`https://images.evetech.net/characters/${character.id}/portrait?size=128`}
              className="rounded-[8px]"
            />
            <AvatarFallback
              className={cn(
                'rounded-[8px] bg-gradient-to-br from-[#1c2a3a] to-[#0e1822] font-accent text-[14px] font-bold',
                character.isMain ? 'text-eve-accent' : 'text-[#7c8ea0]'
              )}
            >
              {character.name[0]}
            </AvatarFallback>
          </Avatar>
          <span
            className="absolute -bottom-0.5 -right-0.5 h-[11px] w-[11px] rounded-full"
            style={{ background: dot.color, border: `2px solid ${dotBorder}` }}
            title={dot.title}
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-[6px]">
            <span className="truncate font-accent text-[14px] font-semibold text-ta-bright">
              {character.name}
            </span>
            {character.isMain && (
              <span
                className="shrink-0 rounded-[5px] px-[6px] py-px font-accent text-[8.5px] font-bold uppercase tracking-[0.06em]"
                style={{ color: '#04141a', background: 'var(--acc, #34b3a4)' }}
              >
                {t('characters.mainBadge')}
              </span>
            )}
            {!character.isMain && (tokenInvalid || stale) && (
              <span
                className="shrink-0 rounded-[5px] border px-[6px] py-px font-accent text-[8.5px] font-semibold uppercase tracking-[0.05em]"
                style={{
                  color: '#e0a94a',
                  background: 'rgba(224,169,74,.09)',
                  borderColor: 'rgba(224,169,74,.24)',
                }}
              >
                {t('characters.badgeStale')}
              </span>
            )}
          </div>
          {corpLine && (
            <div className="truncate text-[11px] text-ta-muted">{corpLine}</div>
          )}
        </div>
      </div>

      {/* Location / Ship */}
      <div className="flex min-w-0 flex-col gap-[3px]">
        {character.location && (
          <div className="flex min-w-0 items-center gap-[6px]">
            <MapPin className="h-3 w-3 shrink-0 text-ta-faint" />
            <span className="truncate font-sans text-[12.5px] text-ta-body">
              {character.location}
            </span>
          </div>
        )}
        {character.ship && (
          <div className="flex min-w-0 items-center gap-[6px]">
            <Ship className="h-3 w-3 shrink-0 text-ta-faint" />
            <span className="truncate text-[11px] text-ta-muted">{character.ship}</span>
          </div>
        )}
        {!character.location && !character.ship && (
          <span className="text-[11px] text-ta-faint">—</span>
        )}
      </div>

      {/* Tags */}
      <CharacterTableTags tags={character.tags ?? []} />

      {/* Wallet */}
      <div className="text-right font-sans text-[13px] font-semibold tabular-nums text-ta-body">
        {formatISK(character.walletBalance)}
      </div>

      {/* SP */}
      <div className="text-right font-sans text-[13px] font-semibold tabular-nums text-ta-secondary">
        {formatSP(character.totalSp)}
      </div>

      {/* Actions */}
      <div className="flex justify-center">
        <CharacterListRowMenu character={character} accountCode={accountCode} />
      </div>
    </div>
  )
}

function HeaderCell({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  align = 'left',
}: {
  label: string
  field?: SortField
  sortField: SortField
  sortOrder: SortOrder
  onSort: (f: SortField) => void
  align?: 'left' | 'right'
}) {
  const active = field && field === sortField
  return (
    <button
      type="button"
      disabled={!field}
      onClick={() => field && onSort(field)}
      className={cn(
        'font-accent text-[10px] font-semibold uppercase tracking-[0.12em] text-ta-faint transition-colors',
        field && 'cursor-pointer hover:text-ta-secondary',
        align === 'right' ? 'text-right' : 'text-left'
      )}
    >
      {label}
      {active && <span className="ml-1">{sortOrder === 'asc' ? '▴' : '▾'}</span>}
    </button>
  )
}

export function CharactersTable({
  characters,
  accountCode,
  groupBy,
}: {
  characters: CharacterListItem[]
  accountCode: string
  groupBy: CharactersGroupBy
}) {
  const { t } = useTranslations()
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')

  const onSort = (f: SortField) => {
    if (f === sortField) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(f)
      setSortOrder(f === 'name' ? 'asc' : 'desc')
    }
  }

  const sorted = useMemo(() => {
    const arr = [...characters]
    arr.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = a.name.localeCompare(b.name)
      else if (sortField === 'walletBalance') cmp = a.walletBalance - b.walletBalance
      else cmp = a.totalSp - b.totalSp
      return sortOrder === 'asc' ? cmp : -cmp
    })
    return arr
  }, [characters, sortField, sortOrder])

  // Buckets for "By role" — computed unconditionally to respect the Rules of Hooks.
  const groups = useMemo(() => {
    const buckets = new Map<string, CharacterListItem[]>()
    const otherKey = '__other__'
    for (const c of sorted) {
      const tags = c.tags ?? []
      const match = ROLE_BUCKETS.find((b) => tags.includes(b.tag))
      const key = match ? match.tag : otherKey
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(c)
    }
    const ordered: {
      key: string
      label: string
      color: string
      members: CharacterListItem[]
      isk: number
    }[] = []
    for (const b of ROLE_BUCKETS) {
      const members = buckets.get(b.tag)
      if (!members || members.length === 0) continue
      const key = CHARACTER_TAG_TRANSLATION_KEYS[b.tag]
      ordered.push({
        key: b.tag,
        label: key ? t(key) : b.tag,
        color: b.color,
        members,
        isk: members.reduce((s, m) => s + (m.walletBalance || 0), 0),
      })
    }
    const other = buckets.get(otherKey)
    if (other && other.length > 0) {
      ordered.push({
        key: otherKey,
        label: t('characters.group.other'),
        color: '#b9c6d2',
        members: other,
        isk: other.reduce((s, m) => s + (m.walletBalance || 0), 0),
      })
    }
    return ordered
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sorted, t])

  const header = (
    <div
      className={cn(
        'sticky top-0 z-10 grid gap-[14px] border-y border-white/[0.06] bg-ta-header px-[18px] py-[11px]',
        GRID
      )}
    >
      <HeaderCell label={t('characters.columnCharacter')} field="name" sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
      <HeaderCell label={t('characters.columnLocationShip')} sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
      <HeaderCell label={t('characters.columnTags')} sortField={sortField} sortOrder={sortOrder} onSort={onSort} />
      <HeaderCell label={t('characters.columnWallet')} field="walletBalance" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
      <HeaderCell label={t('characters.columnSp')} field="totalSp" sortField={sortField} sortOrder={sortOrder} onSort={onSort} align="right" />
      <span />
    </div>
  )

  if (groupBy === 'flat') {
    return (
      <div className="overflow-hidden rounded-[14px] border border-white/[0.07]">
        {header}
        <div>
          {sorted.map((c) => (
            <CharacterRow key={c.id} character={c} accountCode={accountCode} dotBorder="#0b1119" />
          ))}
        </div>
      </div>
    )
  }

  // By role: bucket each character into the first matching role, rest → "Other".
  return (
    <div className="flex flex-col gap-[18px]">
      {groups.map((g) => (
        <section
          key={g.key}
          className="overflow-hidden rounded-[14px] border border-white/[0.07]"
          style={{ background: 'linear-gradient(160deg,#0e1720,#0b1119)' }}
        >
          <div className="flex items-center gap-[11px] border-b border-white/[0.06] px-[18px] py-[13px]">
            <span className="h-[9px] w-[9px] rounded-full" style={{ background: g.color }} />
            <span className="font-accent text-[15px] font-bold tracking-[0.02em] text-white">
              {g.label}
            </span>
            <span className="rounded-[6px] border border-white/[0.08] bg-ta-inset px-2 py-px font-accent text-[11px] font-semibold text-ta-muted">
              {t('characters.group.pilots', { count: g.members.length })}
            </span>
            <span className="ml-auto flex items-center gap-[7px]">
              <span className="font-accent text-[10px] uppercase tracking-[0.1em] text-ta-faint">
                {t('characters.group.groupIsk')}
              </span>
              <span className="font-sans text-[14px] font-bold tabular-nums text-eve-accent">
                {formatISK(g.isk)}
              </span>
            </span>
          </div>
          <div>
            {g.members.map((c) => (
              <CharacterRow key={c.id} character={c} accountCode={accountCode} dotBorder="#0e1720" />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
