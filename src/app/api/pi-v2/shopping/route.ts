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
import { buildShopping } from '@/lib/pi-v2/shopping-service'
import type { WarehouseContainerConfig } from '@/lib/pi-v2/warehouse'
import {
  isPublicHubId,
  type BaseHub,
  type FreightHub,
  type FreightLeg,
} from '@/lib/pi-v2/pricing/freight-model'

const DEFAULT_PERIOD_HRS = 24
const MAX_PERIOD_HRS = 24 * 30

/** Teto de hubs de estrutura: cada um custa uma varredura de book na ESI. */
const MAX_STRUCTURE_HUBS = 6

/**
 * Campo de contrato: `null`/ausente significa **"N/A" na tabela da
 * transportadora** — termo que não existe naquele contrato. Preservar o null é
 * essencial: virar 0 faria "Flat Rate Only" custar nada por m³.
 */
function parseOptionalRate(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function parsePositiveInt(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/**
 * Uma perna. Método desconhecido ou perna sem os dados que a tornam calculável
 * é DESCARTADA, não corrigida por adivinhação — sem perna o hub entra com frete
 * não configurado, que a tela rotula, em vez de um número que ninguém calculou.
 */
function parseLeg(raw: unknown): FreightLeg | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const l = raw as Record<string, unknown>

  if (l.method === 'local') return { method: 'local' }

  if (l.method === 'courier') {
    const leg: FreightLeg = {
      method: 'courier',
      transporter: typeof l.transporter === 'string' ? l.transporter.trim() : '',
      perM3Rate: parseOptionalRate(l.perM3Rate),
      fullLoadReward: parseOptionalRate(l.fullLoadReward),
      fullLoadVolumeM3: parseOptionalRate(l.fullLoadVolumeM3),
      collateralRate: parseOptionalRate(l.collateralRate),
      minReward: parseOptionalRate(l.minReward),
    }
    // Contrato sem nenhum termo não vira frete: seria zero disfarçado. A perna
    // ainda vale (o método está escolhido) e a tela cobra os números.
    return leg
  }

  if (l.method === 'jf') {
    const jfTypeId = parsePositiveInt(l.jfTypeId)
    const isotopeQtyRoundTrip = parsePositiveInt(l.isotopeQtyRoundTrip)
    if (!jfTypeId) return undefined
    const cargoM3 = Number(l.cargoM3)
    return {
      method: 'jf',
      jfTypeId,
      isotopeQtyRoundTrip,
      cargoM3: Number.isFinite(cargoM3) && cargoM3 > 0 ? cargoM3 : 0,
      refuelAt: l.refuelAt === 'origin' || l.refuelAt === 'destination' ? l.refuelAt : undefined,
    }
  }

  return undefined
}

function parseBase(raw: unknown): BaseHub | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>
  const id = typeof b.id === 'string' ? b.id.trim() : ''
  if (!id) return null
  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim() : id
  return { id, name }
}

function parseHubs(raw: unknown): FreightHub[] {
  if (!Array.isArray(raw)) return []
  const out: FreightHub[] = []
  let structureCount = 0
  for (const entry of raw) {
    const e = entry as Record<string, unknown> | null
    const id = typeof e?.id === 'string' ? e.id.trim() : ''
    if (!id) continue
    if (!isPublicHubId(id)) {
      if (structureCount >= MAX_STRUCTURE_HUBS) continue
      structureCount += 1
    }
    out.push({
      id,
      name: typeof e?.name === 'string' && e.name.trim() ? e.name.trim() : id,
      inbound: parseLeg(e?.inbound),
      outbound: parseLeg(e?.outbound),
    })
  }
  return out
}

/** Teto de containers do armazém: cada dono custa uma varredura de assets. */
const MAX_WAREHOUSE_CONTAINERS = 12

/**
 * Containers do Armazém de PI. Entrada sem `itemId` ou sem `characterId` é
 * descartada: sem os dois não há o que procurar, e adivinhar o dono somaria o
 * estoque errado.
 */
function parseWarehouse(raw: string | null): WarehouseContainerConfig[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    const out: WarehouseContainerConfig[] = []
    for (const entry of parsed) {
      const e = entry as Record<string, unknown> | null
      const itemId = Number(e?.itemId)
      const characterId = Number(e?.characterId)
      if (!Number.isFinite(itemId) || itemId <= 0) continue
      if (!Number.isFinite(characterId) || characterId <= 0) continue
      out.push({
        itemId,
        characterId,
        name: typeof e?.name === 'string' && e.name.trim() ? e.name.trim() : `#${itemId}`,
        locationName:
          typeof e?.locationName === 'string' && e.locationName.trim()
            ? e.locationName.trim()
            : undefined,
      })
      if (out.length >= MAX_WAREHOUSE_CONTAINERS) break
    }
    return out
  } catch {
    return []
  }
}

/**
 * O modelo de frete chega como um JSON só (`freight`), porque base e hubs são uma
 * coisa: um hub sem base não tem para onde trazer a carga. Entrada malformada é
 * descartada, nunca adivinhada.
 */
function parseFreight(raw: string | null): { base: BaseHub | null; hubs: FreightHub[] } {
  if (!raw) return { base: null, hubs: [] }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return { base: parseBase(parsed.base), hubs: parseHubs(parsed.hubs) }
  } catch {
    return { base: null, hubs: [] }
  }
}

/**
 * Lista de compra do PI v2 — a resposta à pergunta 2.
 *
 * O frete chega por parâmetro, vindo da preferência local do cliente, em vez de
 * uma coluna nova no banco: é configuração de UMA pessoa (o perfil avançado),
 * afeta só esta análise, e adiar o schema mantém a entrega reversível até os
 * números serem validados contra a tabela manual. Se virar preferência de conta,
 * migra depois — sem desfazer nada.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  await assertPlatformModuleActive('pi')
  if (!isPiV2EnabledFor(user.id)) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'PI v2 is not enabled', 404)
  }

  const { searchParams } = new URL(request.url)

  const periodRaw = Number.parseInt(searchParams.get('periodHours') || '', 10)
  const periodHours =
    Number.isFinite(periodRaw) && periodRaw > 0 ? Math.min(periodRaw, MAX_PERIOD_HRS) : DEFAULT_PERIOD_HRS

  const characterIdRaw = Number.parseInt(searchParams.get('characterId') || '0', 10)
  const characterIdFilter =
    Number.isFinite(characterIdRaw) && characterIdRaw > 0 ? characterIdRaw : undefined

  const forceRefresh = searchParams.get('refresh') === 'true'
  if (forceRefresh) {
    await deleteCacheByPrefix(piColoniesCachePrefixForUser(user.id))
  }

  const { base, hubs } = parseFreight(searchParams.get('freight'))

  const {
    list,
    listNetOfWarehouse,
    stationWarnings,
    jfPlans,
    pnl,
    pnlTotals,
    sellHub,
    warehouse,
    legacyStations,
  } = await buildShopping({
    userId: user.id,
    characters: user.characters.map((c) => ({
      id: c.id,
      name: c.name,
      accessToken: c.accessToken,
    })),
    characterIdFilter,
    periodHours,
    base,
    hubs,
    warehouse: parseWarehouse(searchParams.get('warehouse')),
    forceRefresh,
  })

  return NextResponse.json({
    ...list,
    listNetOfWarehouse,
    stationWarnings,
    jfPlans,
    pnl,
    pnlTotals,
    sellHub,
    warehouse,
    legacyStations,
  })
})
