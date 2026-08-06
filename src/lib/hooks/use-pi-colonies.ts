'use client'

import { useCallback, useEffect, useState } from 'react'
import { normalizePiColoniesResponse } from '@/lib/pi/normalize-response'
import type { PiColoniesResponse } from '@/lib/pi/types'

export type PiColoniesParams = {
  characterId?: number
  refresh?: boolean
}

export function usePiColonies(params: PiColoniesParams, enabled = true) {
  const [data, setData] = useState<PiColoniesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchColonies = useCallback(
    async (options?: { refresh?: boolean; background?: boolean; signal?: AbortSignal }) => {
      if (!enabled) return

      const isRefresh = options?.refresh === true
      // Background polls re-simulate on the server's cached ESI data (no forced
      // ESI fetch, no spinner). They must not flip loading/error state or clear
      // the last good data on a transient blip.
      const isBackground = options?.background === true
      if (!isBackground) {
        if (isRefresh) {
          setRefreshing(true)
        } else {
          setLoading(true)
        }
        setError(null)
      }

      try {
        const qs = new URLSearchParams()
        if (params.characterId) qs.set('characterId', String(params.characterId))
        if (isRefresh) qs.set('refresh', 'true')

        const res = await fetch(`/api/pi/colonies?${qs.toString()}`, { signal: options?.signal })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'Failed to load PI colonies')
        }
        setData(normalizePiColoniesResponse((await res.json()) as PiColoniesResponse))
      } catch (e) {
        if (e instanceof Error && e.name === 'AbortError') return
        if (isBackground) return // keep last good data on a silent poll
        setError(e instanceof Error ? e.message : 'Unknown error')
        if (!isRefresh) setData(null)
      } finally {
        if (!isBackground) {
          if (isRefresh) {
            setRefreshing(false)
          } else {
            setLoading(false)
          }
        }
      }
    },
    [enabled, params.characterId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void fetchColonies({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchColonies])

  // Stable identities so callers can safely use these as effect deps (e.g. the
  // background poll interval) without re-creating the effect every render.
  const refetch = useCallback(() => fetchColonies({ refresh: true }), [fetchColonies])
  const backgroundRefetch = useCallback(() => fetchColonies({ background: true }), [fetchColonies])

  return {
    data,
    loading,
    refreshing,
    error,
    /** Manual, user-triggered refresh: forces a fresh ESI fetch. */
    refetch,
    /** Silent poll: re-simulates on cached ESI data without a forced fetch. */
    backgroundRefetch,
  }
}
