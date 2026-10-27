'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { MiningValuableOreRow } from '@/components/activity/MiningValuableOres'

type CacheKey = string

function cacheKey(type: string, space?: string): CacheKey {
  return `${type}::${space ?? ''}`
}

type MinersRestPricesContextValue = {
  getPrices: (type: string, space?: string) => Promise<MiningValuableOreRow[]>
  loadingKeys: Set<CacheKey>
}

const MinersRestPricesContext = createContext<MinersRestPricesContextValue | null>(
  null
)

export function MinersRestPricesProvider({ children }: { children: ReactNode }) {
  const cacheRef = useRef<Record<CacheKey, MiningValuableOreRow[]>>({})
  const inflightRef = useRef<Record<CacheKey, Promise<MiningValuableOreRow[]>>>({})
  const [loadingKeys, setLoadingKeys] = useState<Set<CacheKey>>(new Set())

  const getPrices = useCallback(async (type: string, space?: string) => {
    const key = cacheKey(type, space)
    if (cacheRef.current[key]) return cacheRef.current[key]

    const inflight = inflightRef.current[key]
    if (inflight) return inflight

    setLoadingKeys((prev) => new Set(prev).add(key))

    const promise = (async () => {
      const q = new URLSearchParams({ type })
      if (space) q.set('space', space)
      const res = await fetch(`/api/sde/mining-types?${q.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Server returned ${res.status}`)
      }
      const data = (await res.json()) as MiningValuableOreRow[]
      const rows = Array.isArray(data) ? data : []
      cacheRef.current[key] = rows
      return rows
    })()

    inflightRef.current[key] = promise

    try {
      return await promise
    } finally {
      delete inflightRef.current[key]
      setLoadingKeys((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [])

  const value = useMemo(
    () => ({ getPrices, loadingKeys }),
    [getPrices, loadingKeys]
  )

  return (
    <MinersRestPricesContext.Provider value={value}>
      {children}
    </MinersRestPricesContext.Provider>
  )
}

export function useMinersRestPrices() {
  const ctx = useContext(MinersRestPricesContext)
  if (!ctx) {
    throw new Error('useMinersRestPrices must be used within MinersRestPricesProvider')
  }
  return ctx
}

export function useMinersRestPriceRows(type: string, space?: string) {
  const { getPrices, loadingKeys } = useMinersRestPrices()
  const [items, setItems] = useState<MiningValuableOreRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const key = cacheKey(type, space)
  const loading = loadingKeys.has(key)

  const load = useCallback(async () => {
    setError(null)
    try {
      const rows = await getPrices(type, space)
      setItems(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setItems([])
    }
  }, [getPrices, type, space])

  return { items, loading, error, load, getPrices }
}
