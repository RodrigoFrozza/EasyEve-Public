export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { isPiV2EnabledFor } from '@/lib/pi-v2/flag'
import { listWarehouseCandidates } from '@/lib/pi-v2/warehouse-service'

/**
 * Containers que o jogador pode designar como Armazém de PI.
 *
 * Rota separada, e **sob demanda**: só é chamada quando ele abre a config. Listar
 * candidatos exige varrer os assets de TODOS os personagens (o container pode
 * estar em qualquer um deles), e isso não pode acontecer no load da tela — a
 * escolha é feita uma vez e o resto do módulo só usa os ids já escolhidos.
 *
 * Personagem sem o scope de assets sai em `charactersWithoutScope` para a tela
 * pedir re-autorização, nunca desaparece da lista em silêncio.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  await assertPlatformModuleActive('pi')
  if (!isPiV2EnabledFor(user.id)) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'PI v2 is not enabled', 404)
  }

  const { searchParams } = new URL(request.url)
  const baseId = searchParams.get('baseId')?.trim() || null

  const result = await listWarehouseCandidates({
    characters: user.characters.map((c) => ({
      id: c.id,
      name: c.name,
      accessToken: c.accessToken,
    })),
    baseId,
  })

  return NextResponse.json(result)
})
