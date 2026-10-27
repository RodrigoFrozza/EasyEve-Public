'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import type { MiningValuableOreRow } from '@/components/activity/MiningValuableOres'
import { getSessionBounds } from '@/lib/activity/activity-analytics'
import {
  buildPriceRowIndexes,
  buildMineralPriceIndex,
  calculateSessionValuation,
  inferMiningCategoryFromBreakdown,
  type MiningPriceSide,
  type OrePriceRow,
  type SessionValuationResult,
} from '@/lib/mining-session-valuation'

const EFFICIENCY_STORAGE_KEY = 'mining-analytics-efficiency'
const PRICE_SIDE_STORAGE_KEY = 'mining-analytics-price-side'
const DEFAULT_EFFICIENCY = 90
const DEFAULT_PRICE_SIDE: MiningPriceSide = 'buy'

function readStoredEfficiency(): number {
  if (typeof window === 'undefined') return DEFAULT_EFFICIENCY
  const raw = localStorage.getItem(EFFICIENCY_STORAGE_KEY)
  const parsed = raw != null ? Number(raw) : NaN
  if (!Number.isFinite(parsed)) return DEFAULT_EFFICIENCY
  return Math.max(50, Math.min(100, Math.round(parsed)))
}

function readStoredPriceSide(): MiningPriceSide {
  if (typeof window === 'undefined') return DEFAULT_PRICE_SIDE
  const raw = localStorage.getItem(PRICE_SIDE_STORAGE_KEY)
  if (raw === 'buy' || raw === 'sell' || raw === 'split') return raw
  return DEFAULT_PRICE_SIDE
}

function toOrePriceRows(rows: MiningValuableOreRow[]): OrePriceRow[] {
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    raw: row.raw,
    refined: row.refined,
    reprocessingProducts: row.reprocessingProducts,
  }))
}

export function useMiningSessionValuation(activity: Activity) {
  const data = (activity.data || {}) as Record<string, unknown>
  const declaredMiningType = String(data.miningType || '')
  const oreBreakdown = (data.oreBreakdown || {}) as Record<
    string,
    {
      name?: string
      quantity: number
      buy?: number
      sell?: number
      compressedBuy?: number
      compressedSell?: number
    }
  >

  const miningType = useMemo(
    () => inferMiningCategoryFromBreakdown(declaredMiningType, oreBreakdown),
    [declaredMiningType, oreBreakdown]
  )

  const sessionTypeIds = useMemo(
    () =>
      Object.keys(oreBreakdown)
        .map((id) => parseInt(id, 10))
        .filter((n) => Number.isFinite(n) && n > 0)
        .sort((a, b) => a - b),
    [oreBreakdown]
  )

  const sessionTypeIdsKey = sessionTypeIds.join(',')

  const [efficiencyPct, setEfficiencyPctState] = useState(DEFAULT_EFFICIENCY)
  const [priceSide, setPriceSideState] = useState<MiningPriceSide>(DEFAULT_PRICE_SIDE)
  const [priceRows, setPriceRows] = useState<MiningValuableOreRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const cacheRef = useRef<Record<string, MiningValuableOreRow[]>>({})

  useEffect(() => {
    setEfficiencyPctState(readStoredEfficiency())
    setPriceSideState(readStoredPriceSide())
  }, [])

  const setEfficiencyPct = useCallback((value: number) => {
    const clamped = Math.max(50, Math.min(100, Math.round(value)))
    setEfficiencyPctState(clamped)
    localStorage.setItem(EFFICIENCY_STORAGE_KEY, String(clamped))
  }, [])

  const setPriceSide = useCallback((side: MiningPriceSide) => {
    setPriceSideState(side)
    localStorage.setItem(PRICE_SIDE_STORAGE_KEY, side)
  }, [])

  useEffect(() => {
    if (sessionTypeIds.length === 0) {
      setPriceRows([])
      return
    }

    const cacheKey = `${miningType}::${sessionTypeIdsKey}`
    let cancelled = false

    const load = async () => {
      if (cacheRef.current[cacheKey]) {
        setPriceRows(cacheRef.current[cacheKey])
        return
      }

      setLoading(true)
      setError(null)
      try {
        const q = new URLSearchParams({
          type: miningType,
          typeIds: sessionTypeIdsKey,
        })
        const res = await fetch(`/api/sde/mining-types?${q.toString()}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Server returned ${res.status}`)
        }
        const rows = (await res.json()) as MiningValuableOreRow[]
        const list = Array.isArray(rows) ? rows : []
        cacheRef.current[cacheKey] = list
        if (!cancelled) setPriceRows(list)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load market data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [miningType, sessionTypeIdsKey, sessionTypeIds.length])

  const { hours } = useMemo(() => getSessionBounds(activity), [activity])

  const priceIndexes = useMemo(() => buildPriceRowIndexes(toOrePriceRows(priceRows)), [priceRows])

  const mineralPrices = useMemo(() => {
    const allProducts = priceRows.flatMap((row) => row.reprocessingProducts ?? [])
    return buildMineralPriceIndex(allProducts)
  }, [priceRows])

  const valuation = useMemo((): SessionValuationResult => {
    return calculateSessionValuation(
      oreBreakdown,
      priceIndexes.byId,
      {
        priceSide,
        efficiencyPct,
        isIceMiningCategory: miningType === 'Ice',
        miningCategory: miningType,
        hours,
        mineralPrices,
      },
      priceIndexes.byBaseName
    )
  }, [oreBreakdown, priceIndexes, priceSide, efficiencyPct, miningType, hours, mineralPrices])

  const valuationByTypeId = useMemo(() => {
    const map = new Map<string, SessionValuationResult['byOre'][number]>()
    for (const row of valuation.byOre) {
      map.set(row.typeId, row)
    }
    return map
  }, [valuation.byOre])

  return {
    efficiencyPct,
    setEfficiencyPct,
    priceSide,
    setPriceSide,
    valuation,
    valuationByTypeId,
    loading,
    error,
    miningType,
  }
}

export type ChartValuationMode = 'raw' | 'refined'

export function getLogValuationValue(
  log: { typeId?: number | string; quantity?: number; estimatedValue?: number; value?: number },
  valuationByTypeId: Map<string, SessionValuationResult['byOre'][number]>,
  mode: ChartValuationMode
): number {
  const typeId = String(log.typeId ?? '')
  const row = valuationByTypeId.get(typeId)
  if (!row) {
    return Number(log.estimatedValue ?? log.value) || 0
  }
  const qty = Number(log.quantity) || 0
  if (qty <= 0) return 0
  const unit = mode === 'raw' ? row.rawUnitPrice : row.refinedUnitPrice
  return qty * unit
}
