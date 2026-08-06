'use client'

import { useCallback, useEffect, useState } from 'react'
import type { LootIntelResponse } from '@/lib/analytics/loot-intel-shared'
import { useTranslations } from '@/i18n/hooks'

export type ExplorationLootIntelParams = {
  scope: 'global' | 'me'
  days?: number
}

export function useExplorationLootIntel(params: ExplorationLootIntelParams, enabled = true) {
  const { t } = useTranslations()
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
      if (params.days && params.scope === 'me') qs.set('days', String(params.days))

      const res = await fetch(`/api/analytics/exploration/intel?${qs.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(
          (err as { error?: string }).error ||
            t('activity.exploration.intel.loadFailed')
        )
      }
      setData((await res.json()) as LootIntelResponse)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('activity.exploration.intel.unknownError'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [enabled, params.scope, params.days, t])

  useEffect(() => {
    void fetchIntel()
  }, [fetchIntel])

  return { data, loading, error, refetch: fetchIntel }
}
