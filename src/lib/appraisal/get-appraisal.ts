import { prisma } from '@/lib/prisma'
import { getCorporationInfo, getAllianceInfo } from '@/lib/esi'
import type { AppraisalLineItem, AppraisalRawEntry } from './types'

/** Public EVE identity of the account that created the appraisal. Everything here
 * is public game info (name + corp/alliance the char belongs to) — no wallet, no
 * tokens, no account data. Fields degrade to null when ESI can't resolve them. */
export interface AppraisalCreator {
  characterId: number
  name: string
  corporation: { id: number; name: string } | null
  alliance: { id: number; name: string } | null
}

export interface SavedAppraisal {
  marketKind: string
  marketLabel: string
  structureId: string | null
  itemsLocation: string | null
  priceModifierPct: number
  /** Free-text seller note. Null for appraisals created before this field existed. */
  comments: string | null
  items: AppraisalLineItem[]
  /** Pre-merge pasted lines for the "stack" toggle. Empty for appraisals created
   * before this field existed — the UI falls back to `items` in that case. */
  rawEntries: AppraisalRawEntry[]
  unresolvedNames: string[]
  totalBuy: number
  totalSell: number
  totalSplit: number
  createdAt: Date
  creator: AppraisalCreator | null
}

/**
 * Resolve the creator's public EVE identity (main character + corp + alliance) for
 * the share page header. Best-effort: any ESI hiccup degrades a field to null
 * rather than failing the whole page (regra de ouro — a failed lookup is surfaced
 * as "unknown", never invented).
 */
async function resolveCreator(userId: string): Promise<AppraisalCreator | null> {
  const character = await prisma.character.findFirst({
    where: { userId },
    orderBy: [{ isMain: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, corporationId: true },
  })
  if (!character) return null

  let corporation: AppraisalCreator['corporation'] = null
  let alliance: AppraisalCreator['alliance'] = null

  if (character.corporationId) {
    try {
      const corpInfo = await getCorporationInfo(character.corporationId)
      corporation = { id: character.corporationId, name: corpInfo.name }
      if (corpInfo.alliance_id) {
        try {
          const allianceInfo = await getAllianceInfo(corpInfo.alliance_id)
          alliance = { id: corpInfo.alliance_id, name: allianceInfo.name }
        } catch {
          alliance = null
        }
      }
    } catch {
      corporation = null
    }
  }

  return { characterId: character.id, name: character.name, corporation, alliance }
}

/**
 * Read a saved appraisal by its public share token. Resolved purely from the
 * secret token (never a session lookup) so both the API route and the public
 * `/a/[token]` page can share it. Returns null when the token is unknown.
 */
export async function getAppraisalByToken(token: string): Promise<SavedAppraisal | null> {
  const trimmed = token?.trim()
  if (!trimmed) return null

  const row = await prisma.appraisal.findUnique({
    where: { shareToken: trimmed },
    select: {
      userId: true,
      marketKind: true,
      marketLabel: true,
      structureId: true,
      itemsLocation: true,
      priceModifierPct: true,
      comments: true,
      items: true,
      rawEntries: true,
      unresolvedNames: true,
      totalBuy: true,
      totalSell: true,
      totalSplit: true,
      createdAt: true,
    },
  })
  if (!row) return null

  const { userId, ...rest } = row
  const creator = await resolveCreator(userId)

  // Legacy rows predate volume/groupName on AppraisalLineItem — normalize the
  // missing fields to null rather than leaving them `undefined` at runtime.
  const items = ((rest.items as unknown as AppraisalLineItem[]) ?? []).map((item) => ({
    ...item,
    volume: item.volume ?? null,
    groupName: item.groupName ?? null,
  }))

  return {
    ...rest,
    items,
    rawEntries: (rest.rawEntries as unknown as AppraisalRawEntry[]) ?? [],
    creator,
  }
}
