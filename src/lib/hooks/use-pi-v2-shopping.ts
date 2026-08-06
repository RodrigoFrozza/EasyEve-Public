'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ColonyPnlEntry, JfPlanInfo, ShoppingList } from '@/lib/pi-v2/shopping-types'
import type { PnlTotals } from '@/lib/pi-v2/pnl'
import type { BaseHub, FreightHub, SellHubChoice } from '@/lib/pi-v2/pricing/freight-model'
import type { WarehouseContainerConfig, WarehouseView } from '@/lib/pi-v2/warehouse'

export type PiV2ShoppingData = ShoppingList & {
  /**
   * A mesma lista com o Armazém de PI descontado — `null` quando nenhum
   * container foi designado. A tela deixa o jogador escolher qual ver.
   */
  listNetOfWarehouse: ShoppingList | null
  /** Hubs de estrutura que não entraram no cálculo (sem mercado/docking). */
  stationWarnings: Array<{ id: string; name: string; reason: 'no_market' }>
  /** A conta de cada JF configurado: preço do isótopo, onde abastecer, ISK/m³. */
  jfPlans: JfPlanInfo[]
  /** P&L por colônia, casado por (characterId, planetId). */
  pnl: ColonyPnlEntry[]
  /** Soma dos NET por colônia — o número do topo da tela. */
  pnlTotals: PnlTotals
  /** Onde o produto é entregue para vender, e o que custa chegar lá. */
  sellHub: SellHubChoice
  /** O Armazém de PI. Ausente quando nenhum container foi designado. */
  warehouse?: WarehouseView
  /** Estruturas do perfil v1, para semear a config nova uma única vez. */
  legacyStations: Array<{ id: string; name: string }>
}

export type PiV2ShoppingParams = {
  periodHours: number
  base: BaseHub | null
  hubs: FreightHub[]
  warehouseContainers: WarehouseContainerConfig[]
  characterId?: number
}

/**
 * Lista de compra do PI v2.
 *
 * Diferente do portfólio, aqui NÃO há poll: a lista puxa book de mercado, e
 * repuxar a cada 60s gastaria orçamento de ESI para mover um número que o
 * jogador está lendo para decidir uma compra. Recarrega quando o período, o
 * frete ou o personagem mudam — e no botão de atualizar.
 */
export function usePiV2Shopping(params: PiV2ShoppingParams, enabled = true) {
  const [data, setData] = useState<PiV2ShoppingData | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // O modelo inteiro vai numa chave só: base e hubs são uma coisa (um hub sem
  // base não tem para onde trazer a carga), e cada termo da perna muda o cálculo
  // — o `per m³` muda a escolha por item, o teto e o piso mudam o total do hub.
  // A saída (`outbound`) fica fora: ela não afeta a lista de compra, e mandá-la
  // aqui faria a lista recarregar ao configurar uma venda.
  const freightKey = JSON.stringify({
    base: params.base,
    hubs: params.hubs.map((hub) => ({ id: hub.id, name: hub.name, inbound: hub.inbound })),
  })
  // Os containers do armazém entram numa chave própria: mudar de container refaz a
  // leitura de assets, mas mexer no frete não deve.
  const warehouseKey = JSON.stringify(params.warehouseContainers)
  const hasWarehouse = params.warehouseContainers.length > 0

  const fetchList = useCallback(
    async (options?: { refresh?: boolean; signal?: AbortSignal }) => {
      if (!enabled) return
      const isRefresh = options?.refresh === true
      if (isRefresh) setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const qs = new URLSearchParams({ periodHours: String(params.periodHours) })
        if (params.characterId) qs.set('characterId', String(params.characterId))
        qs.set('freight', freightKey)
        if (hasWarehouse) qs.set('warehouse', warehouseKey)
        if (isRefresh) qs.set('refresh', 'true')

        const res = await fetch(`/api/pi-v2/shopping?${qs.toString()}`, { signal: options?.signal })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load shopping list')
        }
        setData((await res.json()) as PiV2ShoppingData)
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Unknown error')
        if (!isRefresh) setData(null)
      } finally {
        if (isRefresh) setRefreshing(false)
        else setLoading(false)
      }
    },
    [enabled, params.periodHours, params.characterId, freightKey, warehouseKey, hasWarehouse]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchList({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchList])

  const refetch = useCallback(() => fetchList({ refresh: true }), [fetchList])

  return { data, loading, refreshing, error, refetch }
}
