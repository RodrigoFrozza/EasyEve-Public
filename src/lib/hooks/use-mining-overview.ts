'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MiningPersonalOverviewResponse } from '@/lib/analytics/mining-personal-overview'

export type MiningOverviewParams = {
  days?: number
  characterId?: number
  space?: string
  category?: string
}

export function useMiningOverview(params: MiningOverviewParams, enabled = true) {
  const [data, setData] = useState<MiningPersonalOverviewResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOverview = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      if (params.days && params.days > 0) qs.set('days', String(params.days))
      if (params.characterId) qs.set('characterId', String(params.characterId))
      if (params.space) qs.set('space', params.space)
      if (params.category) qs.set('category', params.category)

      const res = await fetch(`/api/analytics/mining/overview?${qs.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load mining overview')
      }
      setData((await res.json()) as MiningPersonalOverviewResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, params.days, params.characterId, params.space, params.category])

  useEffect(() => {
    void fetchOverview()
  }, [fetchOverview])

  return { data, loading, error, refetch: fetchOverview }
}
