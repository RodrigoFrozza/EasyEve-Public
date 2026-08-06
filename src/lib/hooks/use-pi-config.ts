'use client'

import { useCallback, useEffect, useState } from 'react'

export type PiSellSource = 'home_region' | 'jita_sell' | 'jita_buy' | 'jita_split' | 'structure'

export type PiPreferences = {
  exportTaxRate: number
  importTaxRate?: number | null
  pricingMode: 'import_buy_export_sell' | 'mid_price' | 'pessimistic'
  homeRegionId?: number | null
  buyStructureId?: string | null
  buyStructureName?: string | null
  buyStructureId2?: string | null
  buyStructureName2?: string | null
  sellSource?: PiSellSource
  sellStructureId?: string | null
  sellStructureName?: string | null
  visitCadenceHrs?: number | null
}

export function usePiConfig(enabled = true) {
  const [preferences, setPreferences] = useState<PiPreferences>({
    exportTaxRate: 0.1,
    pricingMode: 'import_buy_export_sell',
    homeRegionId: null,
  })
  const [loading, setLoading] = useState(false)

  const fetchConfig = useCallback(async (options?: { signal?: AbortSignal }) => {
    if (!enabled) return
    setLoading(true)
    try {
      const res = await fetch('/api/pi/config', { signal: options?.signal })
      if (!res.ok) return
      const data = (await res.json()) as { preferences?: PiPreferences }
      if (data.preferences) setPreferences(data.preferences)
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
    } finally {
      setLoading(false)
    }
  }, [enabled])

  useEffect(() => {
    const controller = new AbortController()
    void fetchConfig({ signal: controller.signal })
    return () => controller.abort()
  }, [fetchConfig])

  const savePlanetConfig = useCallback(
    async (input: { planetId: number; surplusForSale?: boolean }) => {
      const res = await fetch('/api/pi/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error('Failed to save PI config')
      await fetchConfig()
    },
    [fetchConfig]
  )

  const savePreferences = useCallback(
    async (next: Partial<PiPreferences>) => {
      const res = await fetch('/api/pi/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: next }),
      })
      if (!res.ok) throw new Error('Failed to save PI preferences')
      await fetchConfig()
    },
    [fetchConfig]
  )

  return {
    preferences,
    loading,
    refetch: fetchConfig,
    savePlanetConfig,
    savePreferences,
  }
}
