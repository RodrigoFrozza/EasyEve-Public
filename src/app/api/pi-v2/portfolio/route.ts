export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { deleteCacheByPrefix } from '@/lib/cache'
import { piColoniesCachePrefixForUser } from '@/lib/pi/cache-keys'
import { isPiV2EnabledFor } from '@/lib/pi-v2/flag'
import { buildPortfolio } from '@/lib/pi-v2/portfolio'

/**
 * Portfólio do PI v2 — a resposta à pergunta 1.
 *
 * **Sem cache de resposta, de propósito.** O v1 cacheia a resposta inteira por 3
 * min, o que faz o poll de 60s devolver o mesmo número três vezes seguidas. Aqui
 * o que é caro (a ESI) já está cacheado uma camada abaixo (`esi-pi`: lista de
 * planetas 60min, layout chaveado por `last_update`), e o que sobra é matemática
 * pura sobre esse dado. Recalcular a cada poll custa CPU desprezível e entrega a
 * projeção avançada até AGORA — que é o ponto do motor.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  await assertPlatformModuleActive('pi')

  // Flag OFF = o módulo não existe para este usuário. 404 em vez de 403: não há
  // nada a pedir permissão para, e o cliente trata como rota inexistente.
  if (!isPiV2EnabledFor(user.id)) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'PI v2 is not enabled', 404)
  }

  const { searchParams } = new URL(request.url)
  const characterIdRaw = Number.parseInt(searchParams.get('characterId') || '0', 10)
  const characterIdFilter =
    Number.isFinite(characterIdRaw) && characterIdRaw > 0 ? characterIdRaw : undefined
  const forceRefresh = searchParams.get('refresh') === 'true'

  // O botão de refresh manual limpa o cache de ESI do usuário — é a única forma
  // de forçar leitura nova; o poll silencioso nunca faz isso.
  if (forceRefresh) {
    await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
  }

  const portfolio = await buildPortfolio({
    userId: user.id,
    characters: user.characters.map((c) => ({
      id: c.id,
      name: c.name,
      accessToken: c.accessToken,
    })),
    characterIdFilter,
    forceRefresh,
  })

  return NextResponse.json(portfolio)
})
