export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { parseEVECargoLines } from '@/lib/parsers/eve-cargo-parser'
import { loadIndustryConfig } from '@/lib/industry/config-store'
import { computeHubScan } from '@/lib/industry/hub-scan'

// Sanity cap on total pasted lines (including duplicates of the same item) —
// mirrors the appraisal route's cap for consistency.
const MAX_RAW_LINES = 1000
// Cap on DISTINCT item names — matches resolveNamesToTypes' own internal cap
// (MAX_NAMES), so nothing gets silently dropped downstream.
const MAX_DISTINCT_NAMES = 500

/**
 * Multi-hub shopping/price scanner: paste an EVE cargo list, get the real
 * order-book price + available quantity to BUY and to SELL the exact needed
 * quantity at EVERY hub the user configured in Industry Settings (buyHubs) — a
 * live, session-only compute-and-display tool, nothing persisted.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = (await request.json().catch(() => ({}))) as { text?: string }
  const text = typeof body.text === 'string' ? body.text : ''

  // Same caps/order as the appraisal route: reject before any DB/ESI work.
  const parsedLines = parseEVECargoLines(text)
  if (parsedLines.length === 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Paste at least one item to scan', 400)
  }
  if (parsedLines.length > MAX_RAW_LINES) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Too many lines (max ${MAX_RAW_LINES})`, 400)
  }
  const distinctNames = new Set(parsedLines.map((l) => l.displayName.toLowerCase()))
  if (distinctNames.size > MAX_DISTINCT_NAMES) {
    throw new AppError(ErrorCodes.INVALID_INPUT, `Too many distinct items (max ${MAX_DISTINCT_NAMES})`, 400)
  }

  const config = await loadIndustryConfig(user.id)
  if (config.buyHubs.length === 0) {
    throw new AppError(
      ErrorCodes.INVALID_INPUT,
      'Configure at least one hub in Industry Settings before scanning',
      400
    )
  }

  const characterIds = user.characters.map((c) => c.id)
  const result = await computeHubScan({ text, hubs: config.buyHubs, characterIds })

  return NextResponse.json(result)
})
