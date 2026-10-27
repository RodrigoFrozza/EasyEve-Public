'use client'

import { useState, useEffect, useMemo, useCallback, useRef, Fragment } from 'react'
import { formatISK, cn } from '@/lib/utils'
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
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown } from 'lucide-react'
import { miningModalTheme } from '@/components/activity/modals/mining/MiningThemedDialog'

export interface MiningPriceData {
  price: number
  buy?: number
  sell?: number
  split?: number
  basis: MiningPriceBasis
  typeId?: number | null
  volume?: number
}

export interface MiningValuableOreRow {
  id: number
  name: string
  raw: MiningPriceData
  compressed: MiningPriceData
  refined: MiningPriceData
  reprocessingProducts?: {
    materialId: number
    quantity: number
    buy: number
    sell: number
    split: number
  }[]
  volume: number
  buy: number // Legacy sorting
  priceBasis: MiningPriceBasis
  priceConfidence: MiningPriceUiConfidence
}

type SortField = 'name' | 'raw' | 'compressed' | 'refined'
type SortDirection = 'asc' | 'desc'

interface MiningValuableOresProps {
  initialType?: string
  space?: string
  lockCategory?: boolean
  /** Cyan glass styling when embedded in mining modals */
  themed?: boolean
}

export function MiningValuableOres({
  initialType = 'Ore',
  space,
  lockCategory,
  themed = false,
}: MiningValuableOresProps) {
  const theme = themed ? miningModalTheme : null
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [cacheLoading, setCacheLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<MiningValuableOreRow[]>([])
  const cacheRef = useRef<Record<string, MiningValuableOreRow[]>>({})
  const [cachedItems, setCachedItems] = useState<Record<string, MiningValuableOreRow[]>>({})
  const [miningType, setMiningType] = useState<string>(initialType)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortField, setSortField] = useState<SortField>('refined')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [hasPreloaded, setHasPreloaded] = useState(false)

  const fetchMiningType = useCallback(async (type: string) => {
    if (cacheRef.current[type]) return cacheRef.current[type]
    
    setError(null)
    const q = new URLSearchParams({ type })
    if (space) q.set('space', space)
    
    try {
      const res = await fetch(`/api/sde/mining-types?${q.toString()}`)
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || `Server returned ${res.status}`)
      }
      
      const data = await res.json()
      
      if (Array.isArray(data)) {
        cacheRef.current[type] = data as MiningValuableOreRow[]
        setCachedItems(prev => ({ ...prev, [type]: data as MiningValuableOreRow[] }))
        return data as MiningValuableOreRow[]
      }
      return []
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load market data'
      setError(msg)
      throw err
    }
  }, [space])

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
    const load = async () => {
      // Check cache first to avoid flashing loading state
      if (cacheRef.current[miningType]) {
        setItems(cacheRef.current[miningType])
        setLoading(false)
        return
      }

      setLoading(true)
      try {
        const data = await fetchMiningType(miningType)
        setItems(data)
        setLoading(false)
      } catch (err) {
        console.error('Mining Market Error:', err)
        setLoading(false)
      }
    }
    
    load()
  }, [miningType, fetchMiningType])

  const sortedItems = useMemo(() => {
    const sorted = [...items].sort((a, b) => {
      let aVal: number | string
      let bVal: number | string

      if (sortField === 'name') {
        aVal = a.name
        bVal = b.name
        return sortDirection === 'asc' 
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string)
      } else {
        aVal = (a[sortField] as MiningPriceData)?.price ?? 0
        bVal = (b[sortField] as MiningPriceData)?.price ?? 0
        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
      }
    })
    return sorted
  }, [items, sortField, sortDirection])

  const filteredItems = useMemo(() => {
    if (!searchQuery) return sortedItems
    const query = searchQuery.toLowerCase()
    return sortedItems.filter(item => 
      item.name.toLowerCase().includes(query)
    )
  }, [sortedItems, searchQuery])

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  const getBaseName = (name: string) => {
    // Suffixes
    let base = name.replace(/\s(I{1,3}V?|V)-Grade$/, '')
    // Prefixes
    const prefixes = [
      'Concentrated', 'Dense', 'Stable', 'Condensed', 'Massive', 'Glossy', 
      'Pristine', 'Smooth', 'Pellucid', 'Golden', 'Radiant', 'Pure', 
      'Sparkling', 'Rich', 'Lustrous', 'Fiery', 'Crystalline', 'Brimful', 
      'Glistening', 'Shimmering', 'Luminous'
    ]
    for (const p of prefixes) {
      if (base.startsWith(p + ' ')) {
        base = base.replace(p + ' ', '')
        break
      }
    }
    return base
  }

  const groupedItems = useMemo(() => {
    const groups: Record<string, { parent: MiningValuableOreRow; children: MiningValuableOreRow[] }> = {}
    
    // First, find exact matches for base names to use as parents
    const allNames = new Set(items.map(i => i.name))
    
    filteredItems.forEach(item => {
      const baseName = getBaseName(item.name)
      
      if (!groups[baseName]) {
        // Find if the base name itself exists in the items list
        const parentItem = items.find(i => i.name === baseName) || item
        groups[baseName] = { 
          parent: parentItem, 
          children: [] 
        }
      }
      
      // Add as child if it's not the item we picked as parent
      if (item.id !== groups[baseName].parent.id) {
        groups[baseName].children.push(item)
      }
    })

    // Sort children within each group by the current sort field
    Object.values(groups).forEach(g => {
      if (g.children.length > 0) {
        g.children.sort((a, b) => {
          let aVal: number | string
          let bVal: number | string
          if (sortField === 'name') {
            aVal = a.name
            bVal = b.name
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
          } else {
            aVal = (a[sortField] as MiningPriceData)?.price ?? 0
            bVal = (b[sortField] as MiningPriceData)?.price ?? 0
            return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
          }
        })
      }
    })

    // Return as array of groups, sorted by the parent item
    return Object.values(groups).sort((a, b) => {
      let aVal: number | string
      let bVal: number | string
      if (sortField === 'name') {
        aVal = a.parent.name
        bVal = b.parent.name
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      } else {
        // For groups, we use the parent's value for top-level sorting
        aVal = (a.parent[sortField] as MiningPriceData)?.price ?? 0
        bVal = (b.parent[sortField] as MiningPriceData)?.price ?? 0
        return sortDirection === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
      }
    })
  }, [items, filteredItems, sortField, sortDirection])

  const toggleGroup = (baseName: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(baseName)) {
      newExpanded.delete(baseName)
    } else {
      newExpanded.add(baseName)
    }
    setExpandedGroups(newExpanded)
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    const activeColor = themed ? 'text-cyan-300' : 'text-amber-400'
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-30" />
    return sortDirection === 'asc' 
      ? <ArrowUp className={cn('h-3 w-3 ml-1 inline', activeColor)} />
      : <ArrowDown className={cn('h-3 w-3 ml-1 inline', activeColor)} />
  }

  const PriceCell = ({ data, isBatch = false }: { data: MiningPriceData, isBatch?: boolean }) => {
    if (!data || (data.price === 0 && data.basis === 'none')) {
      return <span className="text-red-600 font-black tracking-tighter">0.00</span>
    }

    const isBuy = data.basis.includes('buy')
    const isSell = data.basis.includes('sell')

    // Standard batch size for ores is 100. For ice it's 1.
    // The API now returns unit prices for everything.
    const multiplier = isBatch && miningType !== 'Ice' ? 100 : 1
    const displayPrice = data.price * multiplier

    const colorClass = isBuy ? 'text-emerald-400' : isSell ? 'text-amber-400' : 'text-zinc-500'

    return (
      <div className="flex flex-col items-end">
        <span className={`font-mono font-bold ${colorClass}`}>
          {formatISK(displayPrice)}
          {isBatch && miningType !== 'Ice' && (
            <span className="text-[7px] ml-0.5 opacity-50 font-normal">/100</span>
          )}
        </span>
        <span className="text-[7px] uppercase tracking-tighter opacity-30 -mt-1">
          {data.basis.replace('jita_', '').replace('_raw', '').replace('_compressed', '')}
        </span>
      </div>
    )
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
          <span
            className={cn(
              'text-[10px] font-bold uppercase tracking-widest',
              themed && theme ? theme.textMuted : 'text-zinc-500'
            )}
          >
            {getTypeLabel(miningType)} market (Jita)
            {cacheLoading && hasPreloaded && (
              <span className={cn('ml-2', themed ? 'text-cyan-300' : 'text-amber-400')}>
                loading all...
              </span>
            )}
          </span>
          {!lockCategory && (
            <div className="flex flex-wrap items-center gap-3">
              <div
                className={cn(
                  'flex p-0.5',
                  themed
                    ? 'rounded-lg border border-cyan-300/25 bg-cyan-950/40'
                    : 'rounded-none border border-zinc-800 bg-zinc-900/50'
                )}
              >
                {MINING_TYPES.map((type) => {
                  const isActive = miningType === type
                  return (
                    <button
                      key={type}
                      onClick={() => setMiningType(type)}
                      className={cn(
                        'px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-all',
                        themed ? 'rounded-md' : 'rounded-none font-black',
                        isActive
                          ? themed
                            ? cn(theme!.chipActive, 'text-cyan-50')
                            : 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                          : themed
                            ? 'text-cyan-200/60 hover:bg-cyan-400/10 hover:text-cyan-100'
                            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                      )}
                    >
                      {type}
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group/search">
                  <input 
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      'h-8 w-32 px-2 pr-6 text-[10px] transition-all md:w-40',
                      themed
                        ? 'rounded-lg border border-cyan-300/25 bg-black/30 text-cyan-50 placeholder:text-cyan-200/35 focus:border-cyan-200/50 focus:outline-none focus:ring-1 focus:ring-cyan-300/30'
                        : 'rounded-none border border-zinc-800 bg-zinc-950/50 text-zinc-300 placeholder:text-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/20'
                    )}
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 text-[10px] font-bold"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-2">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  'h-6 w-full',
                  themed ? 'rounded-lg bg-cyan-400/10' : 'rounded-none bg-zinc-900'
                )}
              />
            ))}
          </div>
        ) : error ? (
          <div className="space-y-3 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-center">
            <p className="text-red-400 text-xs font-medium">{error}</p>
            <button 
              onClick={() => {
                cacheRef.current = {} // Clear ref cache
                setCachedItems({}) // Clear state cache to force retry
                setLoading(true)
                fetchMiningType(miningType)
                  .then(data => {
                    setItems(data)
                    setLoading(false)
                  })
                  .catch(() => setLoading(false))
              }}
              className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-1.5 text-[10px] font-bold uppercase text-red-100 transition-colors hover:bg-red-500/30"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredItems.length === 0 ? (
          <p className="text-zinc-500 text-xs italic">{t('global.noValidItemsFound')}</p>
        ) : (
          <div
            className={cn(
              'overflow-hidden',
              themed
                ? cn('rounded-xl border shadow-lg', theme!.panel)
                : 'rounded-none border border-zinc-900 bg-black shadow-2xl'
            )}
          >
            <div
              className={cn(
                'max-h-[500px] overflow-x-auto overflow-y-auto custom-scrollbar',
                themed && 'rounded-lg'
              )}
            >
              <table className="w-full min-w-[400px] border-collapse text-[9px] sm:text-[10px]">
                <thead
                  className={cn(
                    'sticky top-0 z-10 uppercase shadow-md backdrop-blur-md',
                    themed
                      ? 'border-b border-cyan-300/25 bg-cyan-950/90 text-cyan-200/70'
                      : 'bg-zinc-900 text-zinc-500'
                  )}
                >
                  <tr>
                    <th 
                      className={cn(
                        'cursor-pointer px-3 py-2.5 text-left font-bold transition-colors',
                        themed ? 'hover:text-cyan-100' : 'bg-zinc-900 hover:text-zinc-300'
                      )}
                      onClick={() => handleSort('name')}
                    >
                      Item <SortIcon field="name" />
                    </th>
                    <th 
                      className={cn(
                        'cursor-pointer px-3 py-2.5 text-right font-bold transition-colors',
                        themed ? 'hover:text-cyan-100' : 'bg-zinc-900 hover:text-zinc-300'
                      )}
                      onClick={() => handleSort('raw')}
                    >
                      RAW <SortIcon field="raw" />
                    </th>
                    <th 
                      className={cn(
                        'cursor-pointer px-3 py-2.5 text-right font-bold transition-colors',
                        themed ? 'hover:text-cyan-100' : 'bg-zinc-900 hover:text-zinc-300'
                      )}
                      onClick={() => handleSort('compressed')}
                    >
                      Compressed <SortIcon field="compressed" />
                    </th>
                    <th 
                      className={cn(
                        'cursor-pointer px-3 py-2.5 text-right font-bold transition-colors',
                        themed ? 'hover:text-cyan-100' : 'bg-zinc-900 hover:text-zinc-300'
                      )}
                      onClick={() => handleSort('refined')}
                    >
                      Refined <SortIcon field="refined" />
                    </th>
                  </tr>
                </thead>
                <tbody className={cn(themed ? 'divide-y divide-cyan-300/10' : 'divide-y divide-zinc-900')}>
                  {groupedItems.map((group) => {
                    const item = group.parent
                    const hasChildren = group.children.length > 0
                    const isExpanded = expandedGroups.has(getBaseName(item.name))
                    const maxVal = Math.max(item.raw.price, item.compressed.price, item.refined.price)
                    
                    return (
                      <Fragment key={item.id}>
                        <tr 
                          className={cn(
                            'group cursor-pointer transition-colors',
                            themed
                              ? cn(
                                  'hover:bg-cyan-400/[0.06]',
                                  hasChildren && 'bg-cyan-400/[0.04]'
                                )
                              : cn(
                                  'hover:bg-zinc-900/60',
                                  hasChildren && 'bg-zinc-900/40'
                                )
                          )}
                          onClick={() => hasChildren && toggleGroup(getBaseName(item.name))}
                        >
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {hasChildren ? (
                                isExpanded ? (
                                  <ChevronDown className={cn('h-3 w-3', themed ? 'text-cyan-300' : 'text-amber-500')} />
                                ) : (
                                  <ChevronRight className={cn('h-3 w-3', themed ? 'text-cyan-400/50' : 'text-zinc-600')} />
                                )
                              ) : (
                                <div className="w-3" />
                              )}
                              <div className="flex flex-col">
                                <span
                                  className={cn(
                                    'truncate font-bold uppercase tracking-tight max-w-[140px]',
                                    themed ? 'text-cyan-50' : 'font-black text-zinc-300'
                                  )}
                                  title={item.name}
                                >
                                  {item.name}
                                  {hasChildren && (
                                    <span
                                      className={cn(
                                        'ml-2 text-[7px] font-normal',
                                        themed ? 'text-cyan-300/60' : 'text-amber-500/50'
                                      )}
                                    >
                                      +{group.children.length} VAR
                                    </span>
                                  )}
                                </span>
                                <span
                                  className={cn(
                                    'text-[8px] font-medium',
                                    themed ? 'text-cyan-200/50' : 'text-zinc-500'
                                  )}
                                >
                                  Vol: {item.volume.toFixed(2)} m³
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="text-right px-3 py-3">
                            <div className={item.raw.price === maxVal && maxVal > 0 ? 'ring-1 ring-emerald-500/20 bg-emerald-500/5 rounded-none p-1' : ''}>
                              <PriceCell data={item.raw} />
                            </div>
                          </td>
                          <td className="text-right px-3 py-3">
                            <div className={item.compressed.price === maxVal && maxVal > 0 ? 'ring-1 ring-emerald-500/20 bg-emerald-500/5 rounded-none p-1' : ''}>
                              <PriceCell data={item.compressed} />
                            </div>
                          </td>
                          <td className="text-right px-3 py-3">
                            <div className={item.refined.price === maxVal && maxVal > 0 ? 'ring-1 ring-emerald-500/20 bg-emerald-500/5 rounded-none p-1' : ''}>
                              <PriceCell data={item.refined} isBatch />
                            </div>
                          </td>
                        </tr>

                        {isExpanded && group.children.map((child) => {
                          const childMaxVal = Math.max(child.raw.price, child.compressed.price, child.refined.price)
                          return (
                            <tr 
                              key={child.id} 
                              className={cn(
                                'border-l-2 transition-colors',
                                themed
                                  ? 'border-cyan-300/25 bg-cyan-950/30 hover:bg-cyan-400/[0.05]'
                                  : 'border-amber-500/20 bg-zinc-950/80 hover:bg-zinc-900/40'
                              )}
                            >
                              <td className="px-3 py-2 pl-8">
                                <div className="flex flex-col">
                                  <span className="text-zinc-400 font-bold uppercase tracking-tight truncate max-w-[120px]" title={child.name}>
                                    {child.name}
                                  </span>
                                  <span className="text-[7px] text-zinc-600">
                                    Vol: {child.volume.toFixed(2)} m³
                                  </span>
                                </div>
                              </td>
                              <td className="text-right px-3 py-2">
                                <PriceCell data={child.raw} />
                              </td>
                              <td className="text-right px-3 py-2">
                                <PriceCell data={child.compressed} />
                              </td>
                              <td className="text-right px-3 py-2">
                                <PriceCell data={child.refined} isBatch />
                              </td>
                            </tr>
                          )
                        })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}