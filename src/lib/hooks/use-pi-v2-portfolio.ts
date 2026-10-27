'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Portfolio } from '@/lib/pi-v2/portfolio'

export type PiV2PortfolioParams = {
  characterId?: number
}

/**
 * Portfólio do PI v2.
 *
 * Duas formas de buscar, de propósito distintas:
 *  - `refetch`: o botão do usuário. Limpa o cache de ESI e força leitura nova.
 *  - `backgroundPoll`: o poll silencioso de 60s. NÃO força ESI — o servidor
 *    reprojeta sobre o dado já cacheado, então o estoque avança na tela sem
 *    custo de API. Nunca mexe em loading/error nem apaga o último dado bom: uma
 *    falha transitória de rede não pode limpar a tela do jogador.
 */
export function usePiV2Portfolio(params: PiV2PortfolioParams, enabled = true) {
  const [data, setData] = useState<Portfolio | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** true quando a rota respondeu 404: a flag PI_V2 está desligada para o usuário. */
  const [unavailable, setUnavailable] = useState(false)

  const fetchPortfolio = useCallback(
    async (options?: { refresh?: boolean; background?: boolean; signal?: AbortSignal }) => {
      if (!enabled) return

      const isRefresh = options?.refresh === true
      const isBackground = options?.background === true
      if (!isBackground) {
        if (isRefresh) setRefreshing(true)
        else setLoading(true)
        setError(null)
      }

      try {
        const qs = new URLSearchParams()
        if (params.characterId) qs.set('characterId', String(params.characterId))
        if (isRefresh) qs.set('refresh', 'true')

        const res = await fetch(`/api/pi-v2/portfolio?${qs.toString()}`, {
          signal: options?.signal,
        })
        if (res.status === 404) {
          setUnavailable(true)
          return
        }
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load PI portfolio')
        }
        setUnavailable(false)
        setData((await res.json()) as Portfolio)
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        if (isBackground) return // mantém o último dado bom num poll silencioso
        setError(e instanceof Error ? e.message : 'Unknown error')
        if (!isRefresh) setData(null)
      } finally {
        if (!isBackground) {
          if (isRefresh) setRefreshing(false)
          else setLoading(false)
        }
      }
    },
    [enabled, params.characterId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchPortfolio({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchPortfolio])

  // Identidades estáveis para poderem ser dependência de efeito (o poll) sem
  // recriar o intervalo a cada render.
  const refetch = useCallback(() => fetchPortfolio({ refresh: true }), [fetchPortfolio])
  const backgroundPoll = useCallback(() => fetchPortfolio({ background: true }), [fetchPortfolio])

  return { data, loading, refreshing, error, unavailable, refetch, backgroundPoll }
}
