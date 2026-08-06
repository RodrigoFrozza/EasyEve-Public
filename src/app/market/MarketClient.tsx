'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Globe, ChevronDown, Package, Search, XCircle, Building2, Loader2, LogIn, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import {
  REGIONS,
  DEFAULT_REGION,
  MarketOrder,
  ItemInfo
} from '@/lib/constants/market'
import { MarketTree } from '@/components/market/MarketTree'
import { OrderPanels } from '@/components/market/OrderTable'
import { MarketHeader } from '@/components/market/MarketHeader'
import { cn } from '@/lib/utils'
import { getTypeIconUrl } from '@/lib/sde'
import { useSession, signIn } from '@/lib/session-client'

interface StructureResult {
  structureId: string
  name: string
}

function StructurePicker({
  structure,
  onPick,
  onClear,
}: {
  structure: StructureResult | null
  onPick: (s: StructureResult) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StructureResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timer = setTimeout(() => {
      fetch(`/api/market/structures?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { structures: [] }))
        .then((d) => { if (!cancelled) setResults(Array.isArray(d.structures) ? d.structures : []) })
        .catch(() => undefined)
        .finally(() => !cancelled && setLoading(false))
    }, 400)
    return () => { cancelled = true; clearTimeout(timer) }
  }, [query])

  if (structure) {
    return (
      <div className="flex items-center gap-2 h-9 px-3 bg-eve-panel border border-eve-accent/40 rounded-lg">
        <Building2 className="w-3.5 h-3.5 text-eve-accent shrink-0" />
        <span className="text-xs text-zinc-200 truncate max-w-[160px]">{structure.name}</span>
        <button onClick={onClear} className="text-zinc-500 hover:text-zinc-300 shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a structure..."
          className="h-9 w-56 pl-8 pr-8 bg-eve-panel border border-eve-border rounded-lg text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-eve-accent/50"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-zinc-500" />}
      </div>
      {results.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-72 max-h-48 overflow-y-auto bg-zinc-900 border border-white/10 rounded-lg shadow-xl z-50">
          {results.map((s) => (
            <button
              key={s.structureId}
              onClick={() => { onPick(s); setQuery(''); setResults([]) }}
              className="block w-full truncate px-3 py-2 text-left text-xs text-zinc-300 hover:bg-white/5"
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MarketClient() {
  const { data: session } = useSession()
  const [categories, setCategories] = useState<any[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)

  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION)
  const [regionOpen, setRegionOpen] = useState(false)
  const [structure, setStructure] = useState<StructureResult | null>(null)

  const [searchQuery, setSearchQuery] = useState('')

  const [selectedItem, setSelectedItem] = useState<ItemInfo | null>(null)
  const [itemDetails, setItemDetails] = useState<ItemInfo | null>(null)
  const [iconBroken, setIconBroken] = useState(false)

  const [sellOrders, setSellOrders] = useState<MarketOrder[]>([])
  const [buyOrders, setBuyOrders] = useState<MarketOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [ordersError, setOrdersError] = useState<string | null>(null)
  const [structureNotice, setStructureNotice] = useState<string | null>(null)

  useEffect(() => {
    const fetchGroups = async () => {
      setLoadingGroups(true)
      setError(null)
      try {
        const res = await fetch('/api/market/groups')
        if (!res.ok) {
          if (res.status === 403) {
            setError('The Market Browser is currently disabled by administrators.')
          } else {
            setError('Failed to load items.')
          }
          return
        }
        const data = await res.json()
        setCategories(data.groups || [])
      } catch (err) {
        console.error('Failed to load market:', err)
        setError('A network error occurred.')
      } finally {
        setLoadingGroups(false)
      }
    }
    fetchGroups()
  }, [])

  const handleItemSelect = useCallback(async (typeId: number) => {
    // Reset pagination and any orders left over from the previously selected item —
    // otherwise switching from a deep page (e.g. page 5) to an item with fewer pages
    // re-fetches page 5 for the new item and renders an empty table.
    setPage(1)
    setOrdersError(null)
    setIconBroken(false)
    try {
      const res = await fetch(`/api/market/item?typeIds=${typeId}`)
      if (!res.ok) {
        setOrdersError('Failed to load item details.')
        return
      }
      const data = await res.json()
      if (data.items && data.items.length > 0) {
        setSelectedItem(data.items[0])
        setItemDetails(data.items[0])
      } else {
        setOrdersError('Item not found.')
      }
    } catch (err) {
      console.error('Failed to fetch item details:', err)
      setOrdersError('A network error occurred.')
    }
  }, [])

  // Deep link from the Industry deficit scanner: /market?type=&structure=&sname=
  // preselects the structure (so orders come from it) and the item.
  const searchParams = useSearchParams()
  useEffect(() => {
    const typeParam = searchParams.get('type')
    const structureParam = searchParams.get('structure')
    const snameParam = searchParams.get('sname')
    if (structureParam && snameParam) {
      setStructure({ structureId: structureParam, name: snameParam })
    }
    if (typeParam) {
      const typeId = Number(typeParam)
      if (Number.isInteger(typeId) && typeId > 0) void handleItemSelect(typeId)
    }
    // Run once on mount from the initial URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedItem) return

    const fetchOrders = async () => {
      setLoadingOrders(true)
      setError(null)
      setOrdersError(null)
      setStructureNotice(null)
      try {
        const params = new URLSearchParams({
          region: String(selectedRegion.id),
          typeId: String(selectedItem.typeId),
          page: String(page),
        })
        if (structure) params.set('structureId', structure.structureId)

        const res = await fetch(`/api/market/orders?${params.toString()}`)
        if (!res.ok) {
          if (res.status === 403) {
            setError('The Market Browser is currently disabled by administrators.')
          } else {
            // Clear stale orders instead of leaving the previous item's data on screen
            // under the newly-selected item's header.
            setSellOrders([])
            setBuyOrders([])
            setPagination(null)
            setOrdersError('Failed to load orders for this item.')
          }
          return
        }
        const data = await res.json()
        setSellOrders(data.sell || [])
        setBuyOrders(data.buy || [])
        setPagination(data.pagination || null)
        if (data.structureError) setStructureNotice(data.structureError)
      } catch (err) {
        console.error('Failed to fetch orders:', err)
        setSellOrders([])
        setBuyOrders([])
        setPagination(null)
        setOrdersError('A network error occurred while loading orders.')
      } finally {
        setLoadingOrders(false)
      }
    }
    fetchOrders()
  }, [selectedItem, selectedRegion, structure, page])

  if (error) {
    return (
      <div className="min-h-screen bg-eve-dark text-zinc-200 selection:bg-eve-accent/30 font-inter">
        <MarketHeader />
        <main className="max-w-4xl mx-auto p-12 text-center">
          <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-2xl p-10">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Market Browser unavailable</h2>
            <p className="text-gray-400 mb-6">{error}</p>
            <Button onClick={() => window.location.href = '/'} className="bg-white text-black hover:bg-zinc-200 px-6 rounded-lg font-semibold text-sm">
              Return Home
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eve-dark text-zinc-200 selection:bg-eve-accent/30 font-inter">
      <MarketHeader />

      <main className="max-w-[1700px] mx-auto p-4 lg:p-6 space-y-4">
        {/* Region / structure bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-950/30 border border-white/5 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm">
            <Globe className="w-4 h-4 text-eve-accent" />
            <span className="text-white font-semibold">{selectedRegion.hub}</span>
            <span className="text-zinc-500">· {selectedRegion.name}</span>
            {structure && <span className="text-eve-accent text-xs ml-1">(showing structure orders)</span>}
          </div>

          <div className="flex items-center gap-2">
            {session?.user ? (
              <StructurePicker
                structure={structure}
                onPick={(s) => { setStructure(s); setPage(1) }}
                onClear={() => setStructure(null)}
              />
            ) : (
              <button
                onClick={() => signIn()}
                className="flex items-center gap-1.5 h-9 px-3 text-xs text-zinc-400 hover:text-white border border-white/10 rounded-lg transition-colors"
                title="Sign in to check orders at a private structure you can dock at"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign in for structure orders
              </button>
            )}

            <div className="relative">
              <button
                onClick={() => setRegionOpen(!regionOpen)}
                className="flex items-center gap-2 h-9 px-3 bg-eve-panel border border-eve-border rounded-lg hover:border-eve-accent/40 transition-colors text-xs font-medium text-zinc-300"
              >
                Change region
                <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', regionOpen && 'rotate-180')} />
              </button>

              <AnimatePresence>
                {regionOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className="absolute right-0 top-full mt-2 w-56 bg-zinc-900 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    <div className="p-1.5">
                      {REGIONS.map(region => (
                        <button
                          key={region.id}
                          onClick={() => {
                            setSelectedRegion(region)
                            setStructure(null)
                            setRegionOpen(false)
                            setPage(1)
                          }}
                          className={cn(
                            'w-full px-3 py-2 text-left rounded-lg transition-colors flex items-center justify-between',
                            selectedRegion.id === region.id
                              ? 'bg-eve-accent text-black font-semibold'
                              : 'text-gray-400 hover:bg-white/5 hover:text-white'
                          )}
                        >
                          <span className="text-sm">{region.hub}</span>
                          <span className={cn('text-[10px]', selectedRegion.id === region.id ? 'text-black/60' : 'text-gray-600')}>{region.name}</span>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">

          {/* Sidebar: item tree */}
          <aside className="lg:col-span-3 flex flex-col h-[calc(100vh-160px)] lg:sticky lg:top-[76px]">
            <div className="flex-1 bg-zinc-950/40 border border-white/5 rounded-xl p-3 overflow-hidden flex flex-col">
              <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-wide px-1 mb-2">Items</h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {loadingGroups ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-eve-accent/30" />
                  </div>
                ) : (
                  <MarketTree
                    categories={categories}
                    selectedItem={itemDetails}
                    onItemSelect={item => handleItemSelect(item.typeId)}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                  />
                )}
              </div>
            </div>
          </aside>

          {/* Main content */}
          <div className="lg:col-span-9 space-y-4">

            {/* Item details */}
            <AnimatePresence mode="wait">
              {itemDetails ? (
                <motion.div
                  key={itemDetails.typeId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="bg-zinc-950/40 border border-white/5 rounded-xl p-4 flex items-center gap-4"
                >
                  <div className="shrink-0 w-14 h-14 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden">
                    {iconBroken ? (
                      <Package className="w-6 h-6 text-zinc-600" />
                    ) : (
                      <Image
                        src={getTypeIconUrl(itemDetails.typeId, 64)}
                        alt={itemDetails.name}
                        width={56}
                        height={56}
                        className="w-14 h-14 object-contain"
                        onError={() => setIconBroken(true)}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-bold text-white truncate">{itemDetails.name}</h2>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-zinc-500 mt-0.5">
                      <span>{itemDetails.categoryName}{itemDetails.groupName ? ` · ${itemDetails.groupName}` : ''}</span>
                      {itemDetails.volume != null && <span>{itemDetails.volume} m³</span>}
                      <span className="text-zinc-600">#{itemDetails.typeId}</span>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-zinc-950/40 border border-white/5 border-dashed rounded-xl p-10 text-center">
                  <Search className="w-8 h-8 text-gray-600 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-white">Select an item</h3>
                  <p className="text-gray-500 text-sm mt-1">Browse the list on the left to see live orders.</p>
                </div>
              )}
            </AnimatePresence>

            {/* Orders */}
            {itemDetails && (
              <div className="bg-zinc-950/40 border border-white/5 rounded-xl overflow-hidden">
                {ordersError && (
                  <div className="px-4 py-3 text-center text-sm font-medium text-red-400 bg-red-500/5 border-b border-red-500/10">
                    {ordersError}
                  </div>
                )}
                {structureNotice && (
                  <div className="px-4 py-3 text-center text-sm font-medium text-amber-400 bg-amber-500/5 border-b border-amber-500/10">
                    {structureNotice} Showing {selectedRegion.hub} region orders instead.
                  </div>
                )}
                <OrderPanels
                  sellOrders={sellOrders}
                  buyOrders={buyOrders}
                  loading={loadingOrders}
                />

                {pagination && pagination.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 py-4 border-t border-white/5">
                    <button
                      onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={page === 1 || loadingOrders}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium text-xs transition-colors disabled:opacity-20"
                    >
                      Prev
                    </button>
                    <span className="text-xs text-zinc-400">Page {page} of {pagination.totalPages}</span>
                    <button
                      onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                      disabled={!pagination?.hasMore || loadingOrders}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg font-medium text-xs transition-colors disabled:opacity-20"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
