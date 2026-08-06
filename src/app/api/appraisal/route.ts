export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { generateShareToken } from '@/lib/characters/share-token'
import { parseEVECargoLines } from '@/lib/parsers/eve-cargo-parser'
import { getRegionalMarketDepth } from '@/lib/market-prices'
import { getStructureMarketDepth } from '@/lib/pi/structure-market'
import { JITA_REGION_ID, JITA_TRADE_HUB_LOCATION_IDS } from '@/lib/constants/market'
import { resolveNamesToTypes } from '@/lib/appraisal/resolve-names'
import { appraiseItems, filterDepthByLocations, type ResolvedAppraisalItem } from '@/lib/appraisal/appraise'
import type { AppraisalRawEntry } from '@/lib/appraisal/types'

// Sanity cap on total pasted lines (including duplicates of the same item).
const MAX_RAW_LINES = 1000
// Cap on DISTINCT item names sent to resolveNamesToTypes — matches that function's
// own internal cap (MAX_NAMES), so nothing gets silently dropped downstream.
const MAX_DISTINCT_NAMES = 500
const MAX_COMMENTS_LENGTH = 1000

/**
 * Create a saved appraisal from a pasted item list, priced against Jita 4-4 or a
 * private structure the account can dock at. Returns a public share token. Prices
 * come only from a real order-book walk (regra de ouro) — thin books and
 * unresolved names are surfaced, never silently zeroed.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = (await request.json().catch(() => ({}))) as {
    text?: string
    marketKind?: string
    structureId?: string
    structureName?: string
    itemsLocation?: string
    priceModifierPct?: number
    comments?: string
  }

  const text = typeof body.text === 'string' ? body.text : ''
  const marketKind = body.marketKind === 'structure' ? 'structure' : 'jita'

  const itemsLocationRaw = typeof body.itemsLocation === 'string' ? body.itemsLocation.trim() : ''
  const itemsLocation = itemsLocationRaw.length > 0 ? itemsLocationRaw.slice(0, 200) : null

  const commentsRaw = typeof body.comments === 'string' ? body.comments.trim() : ''
  const comments = commentsRaw.length > 0 ? commentsRaw.slice(0, MAX_COMMENTS_LENGTH) : null

  // Clamp the price knob to a sane 1%–1000% range; fall back to 100 (unmodified)
  // for anything non-finite or out of bounds rather than storing a junk multiplier.
  const rawPct = Number(body.priceModifierPct)
  const priceModifierPct =
    Number.isFinite(rawPct) && rawPct >= 1 && rawPct <= 1000 ? rawPct : 100

  // Preserves every pasted line (order + duplicates) — the "stack" toggle on the
  // share page needs this to show separate stacks/containers as distinct rows.
  const parsedLines = parseEVECargoLines(text)
  if (parsedLines.length === 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Paste at least one item to appraise', 400)
  }
  if (parsedLines.length > MAX_RAW_LINES) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Too many lines (max ${MAX_RAW_LINES})`, 400)
  }

  const distinctNames = new Set(parsedLines.map((l) => l.displayName.toLowerCase()))
  if (distinctNames.size > MAX_DISTINCT_NAMES) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Too many distinct items (max ${MAX_DISTINCT_NAMES})`, 400)
  }

  const { resolved, unresolved } = await resolveNamesToTypes(parsedLines.map((l) => l.displayName))

  // Raw entries: every pasted line that resolved, in original order/duplicates.
  const rawEntries: AppraisalRawEntry[] = []
  // Aggregated by typeId (two spellings — or duplicate stacks — of the same item
  // collapse here) for pricing: the order book prices a TYPE, not a physical stack.
  const byType = new Map<number, ResolvedAppraisalItem>()
  for (const line of parsedLines) {
    const hit = resolved.get(line.displayName.toLowerCase())
    if (!hit) continue
    rawEntries.push({ typeId: hit.typeId, name: hit.name, quantity: line.quantity })
    const existing = byType.get(hit.typeId)
    if (existing) existing.quantity += line.quantity
    else {
      byType.set(hit.typeId, {
        typeId: hit.typeId,
        name: hit.name,
        quantity: line.quantity,
        volume: hit.volume,
        groupName: hit.groupName,
      })
    }
  }
  const resolvedItems = [...byType.values()]

  if (resolvedItems.length === 0) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'None of the pasted names matched a market item',
      400
    )
  }

  const typeIds = resolvedItems.map((i) => i.typeId)

  let depthByType: Record<number, import('@/lib/market-prices').MarketDepth>
  let marketLabel: string
  let structureId: string | null = null

  if (marketKind === 'structure') {
    structureId = (body.structureId ?? '').trim()
    if (!structureId) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'structureId required for a structure appraisal', 400)
    }
    const characterIds = user.characters.map((c) => c.id)
    depthByType = await getStructureMarketDepth(structureId, characterIds, typeIds)
    marketLabel = (body.structureName ?? '').trim() || 'Private structure'
  } else {
    const regionDepth = await getRegionalMarketDepth(JITA_REGION_ID, typeIds)
    depthByType = filterDepthByLocations(regionDepth, JITA_TRADE_HUB_LOCATION_IDS)
    marketLabel = 'Jita 4-4'
  }

  const result = appraiseItems(resolvedItems, depthByType)
  result.unresolvedNames = unresolved

  const appraisal = await prisma.appraisal.create({
    data: {
      shareToken: generateShareToken(),
      userId: user.id,
      marketKind,
      structureId,
      marketLabel,
      itemsLocation,
      priceModifierPct,
      comments,
      items: result.items as unknown as object[],
      rawEntries: rawEntries as unknown as object[],
      unresolvedNames: unresolved,
      totalBuy: result.totalBuy,
      totalSell: result.totalSell,
      totalSplit: result.totalSplit,
    },
    select: { shareToken: true, createdAt: true },
  })

  return NextResponse.json({
    token: appraisal.shareToken,
    createdAt: appraisal.createdAt,
    marketKind,
    marketLabel,
    structureId,
    itemsLocation,
    priceModifierPct,
    comments,
    rawEntries,
    ...result,
  })
})
