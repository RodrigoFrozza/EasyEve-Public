'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { formatISK } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { MINING_TYPES } from '@/lib/constants/activity-data'
import { MiningPriceConfidence } from '@/components/activity/MiningPriceConfidence'
import type { MiningPriceBasis, MiningPriceUiConfidence } from '@/lib/mining-price-resolution'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export interface MiningValuableOreRow {
  id: number
  name: string
  rawBuy: number
  rawSell: number
  compressedBuy: number
  compressedSell: number
  buy: number
  priceBasis: MiningPriceBasis
  priceConfidence: MiningPriceUiConfidence
}

type SortField = 'name' | 'buy' | 'rawBuy' | 'rawSell' | 'compressedBuy' | 'compressedSell'
type SortDirection = 'asc' | 'desc'

interface MiningValuableOresProps {
  initialType?: string
  space?: string
  lockCategory?: boolean
}

export function MiningValuableOres({ initialType = 'Ore', space, lockCategory }: MiningValuableOresProps) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [items, setItems] = useState<MiningValuableOreRow[]>([])
  const [cachedItems, setCachedItems] = useState<Record<string, MiningValuableOreRow[]>>({})
  const [miningType, setMiningType] = useState<string>(initialType)
  const [sortField, setSortField] = useState<SortField>('buy')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [hasPreloaded, setHasPreloaded] = useState(false)

  const fetchMiningType = useCallback(async (type: string) => {
    if (cachedItems[type]) return cachedItems[type]
    
    const q = new URLSearchParams({ type })
    if (space) q.set('space', space)
    
    const res = await fetch(`/api/sde/mining-types?${q.toString()}`)
    const data = await res.json()
    
    if (Array.isArray(data)) {
      setCachedItems(prev => ({ ...prev, [type]: data as MiningValuableOreRow[] }))
      return data as MiningValuableOreRow[]
    }
    return []
  }, [space, cachedItems])

  useEffect(() => {
    setMiningType(initialType)
  }, [initialType])

  useEffect(() => {
    if (!hasPreloaded && !lockCategory) {
      setCacheLoading(true)
      const loadTypes = async () => {
        for (const type of MINING_TYPES) {
          await fetchMiningType(type)
          await new Promise(resolve => setTimeout(resolve, 300))
        }
        setHasPreloaded(true)
        setCacheLoading(false)
      }
      loadTypes().catch(() => setCacheLoading(false))
    }
  }, [hasPreloaded, lockCategory, fetchMiningType])

  useEffect(() => {
    setLoading(true)
    fetchMiningType(miningType)
      .then(data => {
        setItems(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [miningType, fetchMiningType])

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      const aVal = (a[sortField] as number) ?? 0
      const bVal = (b[sortField] as number) ?? 0
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })
    return sorted
  }, [items, sortField, sortDirection])

  const filteredItems = useMemo(() => {
    return sortedItems.filter((item) => !item.name.startsWith('Compressed '))
  }, [sortedItems])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />
    return sortDirection === 'asc' 
      ? <ArrowUp className="h-3 w-3 ml-1 inline text-amber-400" />
      : <ArrowDown className="h-3 w-3 ml-1 inline text-amber-400" />
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      Ore: 'Ores',
      Ice: 'Ice',
      Gas: 'Gas',
      Moon: 'Moon',
    }
    return labels[type] || type
  }

  const isLoading = loading || (cacheLoading && !cachedItems[miningType])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            {getTypeLabel(miningType)} market (Jita)
            {cacheLoading && hasPreloaded && <span className="ml-2 text-amber-400">loading all...</span>}
          </span>
          {!lockCategory && (
            <Select value={miningType} onValueChange={setMiningType}>
              <SelectTrigger className="h-6 w-24 text-[10px] bg-zinc-900 border-zinc-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINING_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-[10px]">
                    {type} {cachedItems[type] ? '✓' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-6 bg-zinc-900 rounded w-full" />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">{t('global.noValidItemsFound')}</p>
        ) : (
          <div className="bg-zinc-950/50 rounded-lg border border-zinc-800 overflow-x-auto">
            <table className="w-full text-[9px] min-w-[520px]">
              <thead className="bg-zinc-900/50 text-zinc-500 uppercase">
                <tr>
                  <th 
                    className="text-left px-2 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('name')}
                  >
                    Item <SortIcon field="name" />
                  </th>
                  <th 
                    className="text-right px-1 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('buy')}
                  >
                    Unit <SortIcon field="buy" />
                  </th>
                  <th 
                    className="text-right px-1 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('rawBuy')}
                  >
                    Raw buy <SortIcon field="rawBuy" />
                  </th>
                  <th 
                    className="text-right px-1 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('rawSell')}
                  >
                    Raw sell <SortIcon field="rawSell" />
                  </th>
                  <th 
                    className="text-right px-1 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('compressedBuy')}
                  >
                    Cmp buy <SortIcon field="compressedBuy" />
                  </th>
                  <th 
                    className="text-right px-1 py-1.5 font-medium cursor-pointer hover:text-zinc-300"
                    onClick={() => handleSort('compressedSell')}
                  >
                    Cmp sell <SortIcon field="compressedSell" />
                  </th>
                  <th className="text-right px-1 py-1.5 font-medium">Refined</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.slice(0, 20).map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-zinc-900/20' : ''}>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <MiningPriceConfidence confidence={item.priceConfidence} basis={item.priceBasis} />
                        <span className="text-zinc-400 truncate">
                          <span className="text-zinc-600 mr-1">{index + 1}.</span>
                          {item.name}
                        </span>
                      </div>
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-zinc-200">
                      {item.buy > 0 ? formatISK(item.buy) : '—'}
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-emerald-400/90">
                      {item.rawBuy > 0 ? formatISK(item.rawBuy) : '—'}
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-cyan-400/80">
                      {item.rawSell > 0 ? formatISK(item.rawSell) : '—'}
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-emerald-300/70">
                      {item.compressedBuy > 0 ? formatISK(item.compressedBuy) : '—'}
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-cyan-300/70">
                      {item.compressedSell > 0 ? formatISK(item.compressedSell) : '—'}
                    </td>
                    <td className="text-right px-1 py-1.5 font-mono text-zinc-600">—</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}