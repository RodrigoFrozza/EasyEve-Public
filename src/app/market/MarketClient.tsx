'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Globe, ChevronDown, Package, Loader2, Info, Activity, Database, TrendingUp, Search, XCircle } from 'lucide-react'
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
import { getTypeRenderUrl } from '@/lib/sde'

export default function MarketClient() {
  const [categories, setCategories] = useState<any[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  
  const [selectedRegion, setSelectedRegion] = useState(DEFAULT_REGION)
  const [regionOpen, setRegionOpen] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState('')
  
  const [selectedItem, setSelectedItem] = useState<ItemInfo | null>(null)
  const [itemDetails, setItemDetails] = useState<ItemInfo | null>(null)
  
  const [sellOrders, setSellOrders] = useState<MarketOrder[]>([])
  const [buyOrders, setBuyOrders] = useState<MarketOrder[]>([])
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

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
            setError('Failed to load market database.')
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
    try {
      const res = await fetch(`/api/market/item?typeIds=${typeId}`)
      if (res.ok) {
        const data = await res.json()
        if (data.items && data.items.length > 0) {
          setSelectedItem(data.items[0])
          setItemDetails(data.items[0])
        }
      }
    } catch (err) {
      console.error('Failed to fetch item details:', err)
    }
  }, [])

  useEffect(() => {
    if (!selectedItem) return

    const fetchOrders = async () => {
      setLoadingOrders(true)
      setError(null)
      try {
        const res = await fetch(
          `/api/market/orders?region=${selectedRegion.id}&typeId=${selectedItem.typeId}&page=${page}`
        )
        if (!res.ok) {
          if (res.status === 403) {
            setError('The Market Browser is currently disabled by administrators.')
          }
          return
        }
        const data = await res.json()
        setSellOrders(data.sell || [])
        setBuyOrders(data.buy || [])
        setPagination(data.pagination || null)
      } catch (err) {
        console.error('Failed to fetch orders:', err)
      } finally {
        setLoadingOrders(false)
      }
    }
    fetchOrders()
  }, [selectedItem, selectedRegion, page])

  if (error) {
    return (
      <div className="min-h-screen bg-eve-dark text-zinc-200 selection:bg-eve-accent/30 font-inter">
        <MarketHeader />
        <main className="max-w-4xl mx-auto p-12 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[40px] p-16 shadow-2xl"
          >
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-red-500/20">
              <XCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter font-outfit mb-4">Module Unavailable</h2>
            <p className="text-gray-400 text-lg mb-8 leading-relaxed">{error}</p>
            <Button 
              onClick={() => window.location.href = '/'}
              className="bg-white text-black hover:bg-zinc-200 px-8 py-6 rounded-2xl font-black uppercase tracking-widest text-xs"
            >
              Return Home
            </Button>
          </motion.div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-eve-dark text-zinc-200 selection:bg-eve-accent/30 font-inter">
      <MarketHeader />
      
      <main className="max-w-[1800px] mx-auto p-4 lg:p-8 space-y-8">
        {/* Market Stats Bar */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {[
            { label: 'Market Status', value: 'LIVE', icon: Activity, color: 'text-green-500' },
            { label: 'Active Region', value: selectedRegion.hub, icon: Globe, color: 'text-eve-accent' },
            { label: 'Data Source', value: 'ESI API', icon: Database, color: 'text-cyan-400' },
            { label: 'Last Sync', value: 'Real-time', icon: TrendingUp, color: 'text-orange-400' },
          ].map((stat, i) => (
            <div key={i} className="bg-zinc-950/30 backdrop-blur-md border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:bg-white/5 transition-colors">
              <div className={cn("p-2 rounded-xl bg-white/5", stat.color.replace('text-', 'bg-') + '/10')}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
                <p className="text-sm font-black text-white uppercase tracking-tight">{stat.value}</p>
              </div>
            </div>
          ))}
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Sidebar: Market Tree */}
          <motion.aside 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="lg:col-span-3 flex flex-col h-[calc(100vh-140px)] lg:sticky lg:top-[88px]"
          >
            <div className="flex-1 bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-3xl p-6 overflow-hidden flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] font-outfit flex items-center gap-2">
                  <Database className="w-4 h-4 text-eve-accent" />
                  Item Database
                </h2>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                {loadingGroups ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-8 h-8 animate-spin text-eve-accent/30" />
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
          </motion.aside>

          {/* Main Content */}
          <div className="lg:col-span-9 space-y-6">
            
            {/* Context Header: Region & Search Info */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-eve-accent/10 border border-eve-accent/20">
                  <Globe className="w-5 h-5 text-eve-accent" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Active Market Region</p>
                  <h3 className="text-lg font-bold text-white mt-1">{selectedRegion.name} <span className="text-gray-500 font-normal">({selectedRegion.hub})</span></h3>
                </div>
              </div>

              <div className="relative">
                <button
                  onClick={() => setRegionOpen(!regionOpen)}
                  className="flex items-center gap-3 h-12 px-6 bg-zinc-950/40 backdrop-blur-md border border-white/10 rounded-2xl hover:border-eve-accent/40 transition-all group"
                >
                  <span className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-widest">Change Region</span>
                  <ChevronDown className={cn('w-4 h-4 text-gray-500 transition-transform duration-300', regionOpen && 'rotate-180')} />
                </button>
                
                <AnimatePresence>
                  {regionOpen && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute right-0 top-full mt-3 w-64 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl z-[60] overflow-hidden backdrop-blur-xl"
                    >
                      <div className="p-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                        {REGIONS.map(region => (
                          <button
                            key={region.id}
                            onClick={() => {
                              setSelectedRegion(region)
                              setRegionOpen(false)
                              setPage(1)
                            }}
                            className={cn(
                              'w-full px-4 py-3 text-left rounded-xl transition-all flex items-center justify-between group',
                              selectedRegion.id === region.id 
                                ? 'bg-eve-accent text-black font-bold' 
                                : 'text-gray-400 hover:bg-white/5 hover:text-white'
                            )}
                          >
                            <div className="flex flex-col">
                              <span className="text-sm">{region.name}</span>
                              <span className={cn("text-[10px] uppercase tracking-widest opacity-60", selectedRegion.id === region.id ? "text-black" : "text-gray-500")}>{region.hub}</span>
                            </div>
                            {selectedRegion.id === region.id && <TrendingUp className="w-4 h-4" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Item Details Card */}
            <AnimatePresence mode="wait">
              {itemDetails ? (
                <motion.div 
                  key={itemDetails.typeId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[32px] p-8 shadow-2xl relative overflow-hidden group"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none group-hover:scale-110 transition-transform duration-700">
                    <Package className="w-32 h-32 text-white" />
                  </div>

                  <div className="flex flex-col md:flex-row gap-8 relative z-10">
                    <div className="shrink-0 relative">
                      <div className="absolute inset-0 bg-eve-accent/20 blur-2xl rounded-full scale-75 opacity-50" />
                      <Image
                        src={getTypeRenderUrl(itemDetails.typeId, 128)}
                        alt={itemDetails.name}
                        width={128}
                        height={128}
                        className="w-24 h-24 lg:w-40 lg:h-40 object-contain relative z-10 drop-shadow-[0_0_30px_rgba(0,180,255,0.2)]"
                        priority
                      />
                    </div>
                    
                    <div className="flex-1 space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-[10px] font-black text-eve-accent uppercase tracking-[0.3em] font-outfit">Item Specification</span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>
                        <h2 className="text-4xl lg:text-5xl font-black text-white tracking-tighter uppercase font-outfit leading-none mb-1">{itemDetails.name}</h2>
                        <div className="flex items-center gap-2 text-gray-500 font-mono text-sm">
                          <span className="bg-white/5 px-2 py-0.5 rounded text-xs">#{itemDetails.typeId}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                        {[
                          { label: 'Category', value: itemDetails.categoryName, icon: Package },
                          { label: 'Group', value: itemDetails.groupName, icon: Info },
                          { label: 'Volume', value: `${itemDetails.volume} m³`, icon: Database },
                          { label: 'Market State', value: 'Active', icon: Activity },
                        ].map((spec, i) => (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">
                              <spec.icon className="w-3 h-3" />
                              {spec.label}
                            </div>
                            <p className="text-white font-black tracking-tight">{spec.value || 'N/A'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <div className="bg-zinc-950/40 backdrop-blur-md border border-white/5 border-dashed rounded-[32px] p-24 text-center">
                  <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Search className="w-10 h-10 text-gray-600" />
                  </div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-widest font-outfit">Select an Item</h3>
                  <p className="text-gray-500 mt-2 max-w-xs mx-auto">Browse the item database on the left to view real-time market orders and statistics.</p>
                </div>
              )}
            </AnimatePresence>

            {/* Orders Section */}
            <AnimatePresence>
              {itemDetails && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-zinc-950/40 backdrop-blur-md border border-white/5 rounded-[32px] overflow-hidden shadow-2xl"
                >
                  <OrderPanels
                    sellOrders={sellOrders}
                    buyOrders={buyOrders}
                    loading={loadingOrders}
                  />
                  
                  {pagination && pagination.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-6 py-8 border-t border-white/5">
                      <button
                        onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={page === 1 || loadingOrders}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-20 font-outfit"
                      >
                        Prev Page
                      </button>
                      <div className="flex flex-col items-center">
                        <span className="text-2xl font-black text-white font-outfit">{page}</span>
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">of {pagination.totalPages}</span>
                      </div>
                      <button
                        onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                        disabled={!pagination?.hasMore || loadingOrders}
                        className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all disabled:opacity-20 font-outfit"
                      >
                        Next Page
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>
      
    </div>
  )
}
