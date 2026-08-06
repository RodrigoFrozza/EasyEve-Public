'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  Search, 
  Layers, 
  Circle, 
  Zap, 
  Shield, 
  Target, 
  Plus,
  MousePointer2,
  Filter,
  ChevronDown,
  LayoutGrid,
  Info
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { motion, AnimatePresence } from 'framer-motion'

interface Module {
  id: number
  name: string
  groupId: number
  groupName: string
  slotType: string
  metaLevel: number
  metaGroupName: string
  iconId?: number
}

interface ShipItemBrowserProps {
  onItemFit: (item: Module) => void
  onItemSelect: (item: Module) => void
}

const SLOT_TYPES = [
  { id: 'high', name: 'High Slots', icon: Zap },
  { id: 'med', name: 'Medium Slots', icon: Target },
  { id: 'low', name: 'Low Slots', icon: Shield },
  { id: 'rig', name: 'Rig Slots', icon: Layers },
  { id: 'drone', name: 'Drones', icon: Circle },
  { id: 'charge', name: 'Charges', icon: Filter },
]

const META_GROUPS = [
  { id: 'all', name: 'All Tiers' },
  { id: 'Tech I', name: 'Tech I', color: 'text-zinc-400' },
  { id: 'Tech II', name: 'Tech II', color: 'text-blue-400' },
  { id: 'Faction', name: 'Faction', color: 'text-green-400' },
  { id: 'Storyline', name: 'Storyline', color: 'text-purple-400' },
  { id: 'Deadspace', name: 'Deadspace', color: 'text-blue-200' },
  { id: 'Officer', name: 'Officer', color: 'text-purple-200' },
]

export const ShipItemBrowser: React.FC<ShipItemBrowserProps> = ({ onItemFit, onItemSelect }) => {
  const [search, setSearch] = useState('')
  const [activeSlot, setActiveSlot] = useState('high')
  const [activeMeta, setActiveMeta] = useState('all')
  const [modules, setModules] = useState<Module[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchModules = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        if (activeSlot) params.append('slot', activeSlot)
        if (activeMeta !== 'all') params.append('meta', activeMeta)
        params.append('limit', '500') // Higher limit for browsing

        const res = await fetch(`/api/modules?${params.toString()}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setModules(data.modules || [])
      } catch (err) {
        console.error('Failed to fetch modules', err)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchModules, 300)
    return () => clearTimeout(timer)
  }, [search, activeSlot, activeMeta])

  // Group modules by their in-game groupName
  const groupedModules = useMemo(() => {
    const groups: Record<string, Module[]> = {}
    modules.forEach(mod => {
      const g = mod.groupName || 'Uncategorized'
      if (!groups[g]) groups[g] = []
      groups[g].push(mod)
    })
    return groups
  }, [modules])

  return (
    <aside className="w-[450px] border-l border-white/5 bg-black/40 flex flex-col h-full">
      
      {/* Search Header */}
      <div className="p-4 border-b border-white/5 bg-zinc-900/40">
        <div className="mb-4 flex items-center justify-between">
           <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2">
              <LayoutGrid className="w-3.5 h-3.5" /> Hardware_Repository
           </h3>
           <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
           </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input 
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="FILTER_MODULE_DATA_STREAMS..." 
            className="pl-10 h-10 bg-white/5 border-white/5 text-[10px] font-mono tracking-widest uppercase focus-visible:ring-blue-500/50"
          />
        </div>
      </div>

      {/* Slot Type Tabs */}
      <div className="grid grid-cols-3 gap-1 p-2 bg-black/40">
        {SLOT_TYPES.map(slot => (
          <button
            key={slot.id}
            onClick={() => setActiveSlot(slot.id)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl border transition-all gap-1 group",
              activeSlot === slot.id 
                ? "bg-blue-600/10 border-blue-500/30 text-blue-400" 
                : "bg-white/5 border-transparent text-zinc-600 hover:text-zinc-400 hover:bg-white/10"
            )}
          >
            <slot.icon className={cn("w-4 h-4", activeSlot === slot.id ? "text-blue-400" : "text-zinc-500 group-hover:text-zinc-400")} />
            <span className="text-[8px] font-black uppercase tracking-tighter">{slot.name}</span>
          </button>
        ))}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Tier Sidebar */}
        <nav className="w-24 border-r border-white/5 flex flex-col pt-2 bg-black/20">
          {META_GROUPS.map(meta => (
            <button
              key={meta.id}
              onClick={() => setActiveMeta(meta.id)}
              className={cn(
                "w-full py-3 px-2 text-[9px] font-black uppercase tracking-widest text-center transition-all border-l-2",
                activeMeta === meta.id 
                  ? "bg-blue-500/10 text-blue-400 border-blue-500 shadow-[inset_10px_0_20px_rgba(59,130,246,0.05)]" 
                  : "text-zinc-600 border-transparent hover:text-zinc-400 hover:bg-white/5"
              )}
            >
              <div className={cn("text-[7px] mb-0.5 opacity-50", meta.color)}>
                 {meta.id !== 'all' && 'LEVEL'}
              </div>
              {meta.id === 'all' ? 'ALL' : meta.name.split(' ')[0]}
            </button>
          ))}
        </nav>

        {/* Modules List */}
        <section className="flex-1 overflow-hidden relative">
          <ScrollArea className="h-full">
            <div className="p-4 pt-2 space-y-6">
              {loading ? (
                <div className="py-20 text-center">
                   <div className="w-8 h-8 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin mx-auto mb-4" />
                   <p className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">Accessing_Data_Vault...</p>
                </div>
              ) : Object.keys(groupedModules).length > 0 ? (
                Object.entries(groupedModules).map(([groupName, groupModules]) => (
                  <div key={groupName} className="space-y-2">
                    <div className="flex items-center gap-2 group cursor-default">
                       <ChevronDown className="w-3 h-3 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                       <h4 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-zinc-400 transition-colors">
                         {groupName}
                       </h4>
                       <div className="flex-1 h-px bg-white/5" />
                    </div>
                    
                    <div className="space-y-1 pl-2">
                      {groupModules.map(mod => (
                        <ContextMenu key={mod.id}>
                          <ContextMenuTrigger>
                            <button
                              onClick={() => onItemSelect(mod)}
                              onDoubleClick={() => onItemFit(mod)}
                              className="w-full group flex items-center gap-3 p-2 rounded-lg border border-transparent hover:border-white/5 hover:bg-white/5 transition-all text-left"
                            >
                              <div className="w-8 h-8 rounded bg-black border border-white/5 overflow-hidden flex-shrink-0 relative">
                                <Image 
                                  src={`https://images.evetech.net/types/${mod.id}/icon?size=32`}
                                  alt={mod.name}
                                  width={32}
                                  height={32}
                                  className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                />
                                <div className={cn(
                                  "absolute bottom-0 right-0 w-1.5 h-1.5",
                                  mod.metaGroupName === 'Tech II' ? "bg-blue-500" :
                                  mod.metaGroupName === 'Faction' ? "bg-green-500" :
                                  mod.metaGroupName === 'Deadspace' ? "bg-blue-300" :
                                  "bg-zinc-600"
                                )} />
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-bold text-zinc-300 group-hover:text-white transition-colors truncate uppercase tracking-tight">
                                  {mod.name}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={cn(
                                    "text-[7px] font-black uppercase tracking-tighter",
                                    mod.metaGroupName === 'Tech II' ? "text-blue-500" :
                                    mod.metaGroupName === 'Faction' ? "text-green-500" :
                                    "text-zinc-600"
                                  )}>
                                    {mod.metaGroupName}
                                  </span>
                                  <span className="text-[7px] text-zinc-700 font-mono">L{mod.metaLevel}</span>
                                </div>
                              </div>

                              <button 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onItemFit(mod)
                                }}
                                className="w-6 h-6 rounded-md bg-white/5 hover:bg-blue-600/20 text-zinc-700 hover:text-blue-400 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </button>
                          </ContextMenuTrigger>
                          <ContextMenuContent className="bg-zinc-900 border-white/10 text-xs">
                            <ContextMenuItem onClick={() => onItemFit(mod)} className="flex items-center gap-2">
                              <MousePointer2 className="w-3.5 h-3.5" /> Fit to Active Ship
                            </ContextMenuItem>
                            <ContextMenuItem onClick={() => onItemSelect(mod)} className="flex items-center gap-2">
                              <Info className="w-3.5 h-3.5" /> View dogmas & specs
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center opacity-20 flex flex-col items-center gap-4">
                   <Filter className="w-12 h-12" />
                   <div className="text-[9px] font-mono tracking-widest uppercase">No_Matches_InRange</div>
                </div>
              )}
            </div>
          </ScrollArea>
        </section>
      </div>

      {/* Footer Instructions */}
      <div className="p-2 border-t border-white/5 bg-black/40 px-4 flex justify-between items-center opacity-40">
         <div className="flex items-center gap-2 text-[8px] font-mono uppercase tracking-widest text-zinc-500">
            <MousePointer2 className="w-2.5 h-2.5" /> Double-Click to Fit
         </div>
         <div className="text-[8px] font-mono text-zinc-700">SRN: {modules.length}U</div>
      </div>
    </aside>
  )
}
