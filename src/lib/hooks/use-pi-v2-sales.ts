'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SalesBacklogItem } from '@/lib/pi-v2/sales-backlog'
import type { WarehouseContainerConfig, WarehouseContainerStatus } from '@/lib/pi-v2/warehouse'

/**
 * Cache dos itens de contrato já classificados (`contract_id` → itens).
 *
 * A composição de um contrato NUNCA muda depois de criado — então, uma vez
 * conhecido, o item de um `contract_id` vale para sempre. Guardar em localStorage
 * evita rechamar `/contracts/{id}/items/` a cada abertura da aba; só os
 * `contract_id` novos desde a última vez são buscados pelo servidor.
 *
 * Chave própria (`pi-v2:`), mesmo padrão de `pi-v2:freightContracts`.
 */
const CACHE_KEY = 'pi-v2:contractItemCache'

type ContractItemCache = Record<string, Array<{ typeId: number; quantity: number }>>

function readCache(): ContractItemCache {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as ContractItemCache) : {}
  } catch {
    return {}
  }
}

function writeCache(cache: ContractItemCache) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // ignora falha de storage (modo privado, cota) — a classificação ainda vale
    // nesta sessão, só não sobrevive ao reload
  }
}

export interface PiV2SalesData {
  items: SalesBacklogItem[]
  incomplete: boolean
  containers: WarehouseContainerStatus[]
  fetchedAt: string
}

export interface PiV2SalesParams {
  /** Só os containers designados `role: 'sell'` — o hook não filtra por conta própria. */
  saleContainers: WarehouseContainerConfig[]
}

/**
 * Backlog de venda de PI (Frente 2).
 *
 * Sem poll: o sinal é "quanto está parado", não algo que muda minuto a minuto —
 * mesmo padrão sem-poll já usado pela lista de compra.
 */
export function usePiV2Sales(params: PiV2SalesParams, enabled = true) {
  const [data, setData] = useState<PiV2SalesData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const containersKey = JSON.stringify(params.saleContainers)

  const fetchBacklog = useCallback(
    async (signal?: AbortSignal) => {
      if (!enabled) return
      setLoading(true)
      setError(null)
      try {
        const knownItemsByContractId = readCache()
        const res = await fetch('/api/pi-v2/sales-backlog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            // Via containersKey (não params.saleContainers direto): mantém a
            // dependência do callback exaustiva sem precisar de eslint-disable.
            containers: JSON.parse(containersKey),
            knownItemsByContractId,
          }),
          signal,
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load sales backlog')
        }
        const json = (await res.json()) as PiV2SalesData & {
          newItemsByContractId: ContractItemCache
        }

        if (Object.keys(json.newItemsByContractId).length > 0) {
          writeCache({ ...knownItemsByContractId, ...json.newItemsByContractId })
        }

        setData({
          items: json.items,
          incomplete: json.incomplete,
          containers: json.containers,
          fetchedAt: json.fetchedAt,
        })
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        setError(e instanceof Error ? e.message : 'Unknown error')
        setData(null)
      } finally {
        setLoading(false)
      }
    },
    [enabled, containersKey]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchBacklog(controller.signal)
    return () => controller.abort()
  }, [fetchBacklog])

  return { data, loading, error, refetch: () => fetchBacklog() }
}
