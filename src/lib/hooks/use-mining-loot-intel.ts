'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LootIntelResponse } from '@/lib/analytics/loot-intel-shared'

export type MiningLootIntelParams = {
  scope: 'global' | 'me'
  category?: string
  space?: string
  days?: number
}

export function useMiningLootIntel(params: MiningLootIntelParams, enabled = true) {
  const [data, setData] = useState<LootIntelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIntel = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('scope', params.scope)
      if (params.category) qs.set('category', params.category)
      if (params.space) qs.set('space', params.space)
      if (params.days && params.scope === 'me') qs.set('days', String(params.days))

      const res = await fetch(`/api/analytics/mining/intel?${qs.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load mining intel')
      }
      setData((await res.json()) as LootIntelResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, params.scope, params.category, params.space, params.days])

  useEffect(() => {
    void fetchIntel()
  }, [fetchIntel])

  return { data, loading, error, refetch: fetchIntel }
}
