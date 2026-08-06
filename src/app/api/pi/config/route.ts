export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { deleteCacheByPrefix } from '@/lib/cache'
import { piColoniesCachePrefixForUser } from '@/lib/pi/cache-keys'
import { prisma } from '@/lib/prisma'
import { loadPiUserConfig } from '@/lib/pi/pi-config-store'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  await assertPlatformModuleActive('pi')

  const { configs, preferences } = await loadPiUserConfig(user.id)
  return NextResponse.json({ configs, preferences })
})

export const PUT = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  await assertPlatformModuleActive('pi')

  const body = (await request.json()) as {
    planetId?: number
    surplusForSale?: boolean
    preferences?: {
      exportTaxRate?: number
      importTaxRate?: number | null
      pricingMode?: string
      homeRegionId?: number | null
      buyStructureId?: string | null
      buyStructureName?: string | null
      buyStructureId2?: string | null
      buyStructureName2?: string | null
      sellSource?: string
      sellStructureId?: string | null
      sellStructureName?: string | null
      visitCadenceHrs?: number | null
    }
  }

  if (body.preferences) {
    const p = body.preferences
    const exportTaxRate = p.exportTaxRate
    const importTaxRate = p.importTaxRate
    const pricingMode = p.pricingMode
    const homeRegionId = p.homeRegionId
    const sellSource = p.sellSource
    const visitCadenceHrs = p.visitCadenceHrs
    if (
      exportTaxRate != null &&
      (!Number.isFinite(exportTaxRate) || exportTaxRate < 0 || exportTaxRate > 1)
    ) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'exportTaxRate must be between 0 and 1', 400)
    }
    if (
      importTaxRate != null &&
      (!Number.isFinite(importTaxRate) || importTaxRate < 0 || importTaxRate > 1)
    ) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'importTaxRate must be between 0 and 1', 400)
    }
    const allowedModes = ['import_buy_export_sell', 'mid_price', 'pessimistic', 'realistic'] as const
    if (pricingMode != null && !allowedModes.includes(pricingMode as (typeof allowedModes)[number])) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid pricingMode', 400)
    }
    const allowedSellSources = [
      'home_region',
      'jita_sell',
      'jita_buy',
      'jita_split',
      'structure',
    ] as const
    if (
      sellSource != null &&
      !allowedSellSources.includes(sellSource as (typeof allowedSellSources)[number])
    ) {
      throw new AppError(ErrorCodes.INVALID_INPUT, 'Invalid sellSource', 400)
    }
    // null clears the cadence (falls back to the 24h default). Guard against
    // absurd values that would silence or spam every alert.
    if (
      visitCadenceHrs != null &&
      (!Number.isInteger(visitCadenceHrs) || visitCadenceHrs < 1 || visitCadenceHrs > 720)
    ) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        'visitCadenceHrs must be an integer between 1 and 720 hours',
        400
      )
    }
    // null clears the home region (falls back to Jita). EVE region ids live in
    // the 10000000-range (known space, incl. null-sec and Pochven) — reject
    // out-of-range values like "7" that would fetch an empty/invalid market.
    if (
      homeRegionId != null &&
      (!Number.isInteger(homeRegionId) || homeRegionId < 10000000 || homeRegionId > 11000000)
    ) {
      throw new AppError(
        ErrorCodes.INVALID_INPUT,
        'homeRegionId must be a valid EVE region id (an 8-digit number like 10000060)',
        400
      )
    }

    const prefFields = {
      ...(exportTaxRate != null ? { piExportTaxRate: exportTaxRate } : {}),
      ...(importTaxRate !== undefined ? { piPocoImportRate: importTaxRate } : {}),
      ...(pricingMode != null ? { piPricingMode: pricingMode } : {}),
      ...(homeRegionId !== undefined ? { piHomeRegionId: homeRegionId } : {}),
      ...(p.buyStructureId !== undefined ? { piBuyStructureId: p.buyStructureId } : {}),
      ...(p.buyStructureName !== undefined ? { piBuyStructureName: p.buyStructureName } : {}),
      ...(p.buyStructureId2 !== undefined ? { piBuyStructureId2: p.buyStructureId2 } : {}),
      ...(p.buyStructureName2 !== undefined ? { piBuyStructureName2: p.buyStructureName2 } : {}),
      ...(sellSource != null ? { piSellSource: sellSource } : {}),
      ...(p.sellStructureId !== undefined ? { piSellStructureId: p.sellStructureId } : {}),
      ...(p.sellStructureName !== undefined ? { piSellStructureName: p.sellStructureName } : {}),
      ...(visitCadenceHrs !== undefined ? { piVisitCadenceHrs: visitCadenceHrs } : {}),
    }

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: prefFields,
      create: { userId: user.id, ...prefFields },
    })

    await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
    return NextResponse.json({ success: true })
  }

  const planetId = body.planetId
  if (!Number.isFinite(planetId) || (planetId ?? 0) <= 0) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'planetId is required', 400)
  }

  const config = await prisma.piPlanetConfig.upsert({
    where: {
      userId_planetId: {
        userId: user.id,
        planetId: planetId!,
      },
    },
    update: {
      ...(body.surplusForSale !== undefined ? { surplusForSale: body.surplusForSale } : {}),
    },
    create: {
      userId: user.id,
      planetId: planetId!,
      surplusForSale: body.surplusForSale ?? true,
    },
  })

  // Invalidate AFTER the write — invalidating first lets a concurrent GET
  // re-populate the cache with the pre-write config, which then sticks for the
  // full 10min TTL.
  await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))

  return NextResponse.json({
    planetId: config.planetId,
    surplusForSale: config.surplusForSale,
  })
})
