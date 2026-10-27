'use client'

import { useCallback, useEffect, useState } from 'react'
import type { SalvageIntelResponse } from '@/lib/analytics/salvaging-intel'

export type SalvagingIntelParams = {
  scope: 'global' | 'me'
  faction?: string
  space?: string
  days?: number
}

export function useSalvagingIntel(params: SalvagingIntelParams, enabled = true) {
  const [data, setData] = useState<SalvageIntelResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchIntel = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams()
      qs.set('scope', params.scope)
      if (params.faction) qs.set('faction', params.faction)
      if (params.space) qs.set('space', params.space)
      if (params.days && params.scope === 'me') qs.set('days', String(params.days))

      const res = await fetch(`/api/analytics/salvaging/intel?${qs.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to load salvaging intel')
      }
      const json = (await res.json()) as SalvageIntelResponse
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, params.scope, params.faction, params.space, params.days])

  useEffect(() => {
    void fetchIntel()
  }, [fetchIntel])

  return { data, loading, error, refetch: fetchIntel }
}
