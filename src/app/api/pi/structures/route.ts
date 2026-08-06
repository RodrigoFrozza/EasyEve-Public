export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { probeStructureMarket, searchStructures } from '@/lib/pi/structure-market'
import { keepStationsWithMarket, MAX_MARKET_PROBES } from '@/lib/pi-v2/station-search'

/**
 * Search structures the player can dock at / see, by name — for the trade-hub
 * dropdown. Uses the user's first character token for the authenticated search.
 *
 * `?withMarket=1` (opt-in) filtra para estruturas que têm mercado ativo. É
 * **opt-in de propósito**: o modal de settings do v1 consome o mesmo endpoint, e
 * mudar o resultado dele alteraria o comportamento de quem está com a flag
 * `PI_V2` desligada. Só o painel de estações do v2 pede o filtro.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  await assertPlatformModuleActive('pi')

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') ?? '').trim()
  if (query.length < 3) {
    return NextResponse.json({ structures: [] })
  }

  const characterIds = user.characters.map((c) => c.id)
  if (characterIds.length === 0) {
    return NextResponse.json({ structures: [] })
  }

  const structures = await searchStructures(characterIds, query)
  if (searchParams.get('withMarket') !== '1' || structures.length === 0) {
    return NextResponse.json({ structures })
  }

  // Uma chamada ESI por estrutura (só a 1ª página do book). Em paralelo e com
  // teto: o que passar do teto entra como `unknown` e aparece com ressalva, em
  // vez de sumir por não termos olhado.
  const probed = structures.slice(0, MAX_MARKET_PROBES)
  const outcomes = await Promise.all(
    probed.map(async (s) => [s.structureId, await probeStructureMarket(s.structureId, characterIds)] as const)
  )

  return NextResponse.json({
    structures: keepStationsWithMarket(structures, new Map(outcomes)),
  })
})
