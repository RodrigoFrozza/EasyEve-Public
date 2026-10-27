'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { LootIntelResponse } from '@/lib/analytics/loot-intel-shared'

export type AbyssalLootIntelParams = {
  scope: 'global' | 'me'
  tier?: string
  weather?: string
  days?: number
}

export function useAbyssalLootIntel(params: AbyssalLootIntelParams, enabled = true) {
  const [data, setData] = useState<LootIntelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)

  const fetchIntel = useCallback(async (signal?: AbortSignal) => {
    if (!enabled) return

    const requestId = ++requestIdRef.current
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('scope', params.scope)
      if (params.tier) qs.set('tier', params.tier)
      if (params.weather) qs.set('weather', params.weather)
      if (params.days && params.scope === 'me') qs.set('days', String(params.days))

      const res = await fetch(`/api/analytics/abyssal/intel?${qs.toString()}`, { signal })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load abyssal intel')
      }
      const payload = (await res.json()) as LootIntelResponse
      if (requestId === requestIdRef.current) {
        setData(payload)
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      if (requestId === requestIdRef.current) {
        setError(e instanceof Error ? e.message : 'Unknown error')
        setData(null)
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false)
      }
    }
  }, [enabled, params.scope, params.tier, params.weather, params.days])

  useEffect(() => {
    const controller = new AbortController()
    void fetchIntel(controller.signal)
    return () => controller.abort()
  }, [fetchIntel])

  return { data, loading, error, refetch: () => fetchIntel() }
}
