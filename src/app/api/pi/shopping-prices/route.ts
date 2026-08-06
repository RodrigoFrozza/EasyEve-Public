export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { getRegionalMarketDepth } from '@/lib/market-prices'
import { JITA_REGION_ID } from '@/lib/constants/market'
import { getStructureMarketDepth } from '@/lib/pi/structure-market'
import { loadPiUserConfig } from '@/lib/pi/pi-config-store'
import { buildShoppingPriceRows } from '@/lib/pi/shopping-prices'

const MAX_TYPE_IDS = 200

/**
 * Price + available sell-order volume for the Shopping List's comparison
 * columns (primary structure, secondary structure, Jita). Structure lookups are
 * opt-in and independent of the P&L pricing chain.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  await assertPlatformModuleActive('pi')

  const { searchParams } = new URL(request.url)
  const typeIds = (searchParams.get('typeIds') ?? '')
    .split(',')
    .map((s) => Number.parseInt(s, 10))
    .filter((n) => Number.isInteger(n) && n > 0)
    .slice(0, MAX_TYPE_IDS)

  if (typeIds.length === 0) {
    return NextResponse.json({ prices: {} })
  }

  const { preferences } = await loadPiUserConfig(user.id)
  const characterIds = user.characters.map((c) => c.id)

  const [primaryDepth, secondaryDepth, jitaDepth] = await Promise.all([
    preferences.buyStructureId && characterIds.length > 0
      ? getStructureMarketDepth(preferences.buyStructureId, characterIds, typeIds)
      : Promise.resolve(null),
    preferences.buyStructureId2 && characterIds.length > 0
      ? getStructureMarketDepth(preferences.buyStructureId2, characterIds, typeIds)
      : Promise.resolve(null),
    getRegionalMarketDepth(JITA_REGION_ID, typeIds),
  ])

  const prices = buildShoppingPriceRows(typeIds, { primaryDepth, secondaryDepth, jitaDepth })
  return NextResponse.json({ prices })
})
