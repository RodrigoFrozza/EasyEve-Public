export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { assertPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { isPiV2EnabledFor } from '@/lib/pi-v2/flag'
import { readSaleContainers } from '@/lib/pi-v2/warehouse-service'
import { readOwnContracts } from '@/lib/pi-v2/contracts-service'
import { buildSalesBacklog } from '@/lib/pi-v2/sales-backlog'
import type { OwnContractItem } from '@/lib/pi-v2/sales-backlog'
import type { WarehouseContainerConfig } from '@/lib/pi-v2/warehouse'

/** Teto de containers de venda: cada dono custa uma varredura de assets. */
const MAX_SALE_CONTAINERS = 12

function parseSaleContainers(raw: unknown): WarehouseContainerConfig[] {
  if (!Array.isArray(raw)) return []
  const out: WarehouseContainerConfig[] = []
  for (const entry of raw) {
    const e = entry as Record<string, unknown> | null
    const itemId = Number(e?.itemId)
    const characterId = Number(e?.characterId)
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    if (!Number.isFinite(characterId) || characterId <= 0) continue
    out.push({
      itemId,
      characterId,
      role: 'sell',
      name: typeof e?.name === 'string' && e.name.trim() ? e.name.trim() : `#${itemId}`,
      locationName:
        typeof e?.locationName === 'string' && e.locationName.trim()
          ? e.locationName.trim()
          : undefined,
    })
    if (out.length >= MAX_SALE_CONTAINERS) break
  }
  return out
}

function parseKnownItems(raw: unknown): Map<number, OwnContractItem[]> {
  const map = new Map<number, OwnContractItem[]>()
  if (!raw || typeof raw !== 'object') return map
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const contractId = Number(key)
    if (!Number.isFinite(contractId) || !Array.isArray(value)) continue
    const items: OwnContractItem[] = []
    for (const entry of value) {
      const e = entry as Record<string, unknown> | null
      const typeId = Number(e?.typeId)
      const quantity = Number(e?.quantity)
      if (!Number.isFinite(typeId) || typeId <= 0) continue
      if (!Number.isFinite(quantity) || quantity < 0) continue
      items.push({ typeId, quantity })
    }
    map.set(contractId, items)
  }
  return map
}

/**
 * Backlog de venda de PI (Frente 2) — quanto PI pronto está parado sem virar ISK.
 *
 * POST (não GET) porque o corpo carrega o cache local de itens de contrato já
 * classificados (`knownItemsByContractId`) — a composição de um contrato não
 * muda depois de criado, então o client só reconsulta `/contracts/{id}/items/`
 * para os que ainda não conhece. `newItemsByContractId` na resposta é o que o
 * client precisa mesclar de volta no próprio cache.
 */
export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)

  await assertPlatformModuleActive('pi')
  if (!isPiV2EnabledFor(user.id)) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'PI v2 is not enabled', 404)
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const containers = parseSaleContainers(body.containers)
  const knownItemsByContractId = parseKnownItems(body.knownItemsByContractId)

  const characters = user.characters.map((c) => ({
    id: c.id,
    name: c.name,
    accessToken: c.accessToken,
  }))

  const [containerResult, contractResult] = await Promise.all([
    readSaleContainers({ characters, config: containers }),
    readOwnContracts({ characters, knownItemsByContractId }),
  ])

  const backlog = buildSalesBacklog({
    containerStock: containerResult.byType,
    containerIncomplete: containerResult.incomplete,
    contracts: contractResult.contracts,
    contractsIncomplete: contractResult.incomplete,
  })

  return NextResponse.json({
    items: backlog.items,
    incomplete: backlog.incomplete,
    containers: containerResult.containers,
    newItemsByContractId: Object.fromEntries(contractResult.newItemsByContractId),
    fetchedAt: new Date().toISOString(),
  })
})
