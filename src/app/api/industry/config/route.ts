export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  loadIndustryConfig,
  saveIndustryConfig,
  NPC_HUBS,
  type IndustryConfigData,
} from '@/lib/industry/config-store'

export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const config = await loadIndustryConfig(user.id)
  // The account's characters populate the "industry character" (skills) picker.
  const characters = user.characters
    .map((c) => ({ id: c.id, name: c.name, isMain: c.isMain }))
    .sort((a, b) => (a.isMain === b.isMain ? a.name.localeCompare(b.name) : a.isMain ? -1 : 1))
  return NextResponse.json({ config, npcHubs: NPC_HUBS, characters })
})

export const PUT = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  const body = (await request.json().catch(() => ({}))) as Partial<IndustryConfigData>
  const config = await saveIndustryConfig(user.id, {
    buyHubs: Array.isArray(body.buyHubs) ? body.buyHubs : [],
    sellHub: body.sellHub ?? null,
    defaultMe: typeof body.defaultMe === 'number' ? body.defaultMe : 0,
    factory: body.factory ?? null,
    monitoredStations: Array.isArray(body.monitoredStations) ? body.monitoredStations : [],
    salesTaxPct: typeof body.salesTaxPct === 'number' ? body.salesTaxPct : null,
    brokerFeePct: typeof body.brokerFeePct === 'number' ? body.brokerFeePct : null,
    industryCharacterId:
      typeof body.industryCharacterId === 'number' ? body.industryCharacterId : null,
  })
  return NextResponse.json({ config, npcHubs: NPC_HUBS })
})
