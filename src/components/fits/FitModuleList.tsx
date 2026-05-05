'use client'

import React from 'react'
import { Module, Drone, CargoItem, Fighter } from '@/types/fit'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { Power, Trash2, Circle } from 'lucide-react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ModifierBreakdown } from './ModifierBreakdown'

interface SlotCounts {
  high: number | { used: number; total: number; overflow: boolean }
  med: number | { used: number; total: number; overflow: boolean }
  low: number | { used: number; total: number; overflow: boolean }
  rig: number | { used: number; total: number; overflow: boolean }
  service?: number | { used: number; total: number; overflow: boolean }
}

interface FitModuleListProps {
  modules: Module[]
  drones: Drone[]
  fighters?: Fighter[]
  cargo: CargoItem[]
  slotCounts?: SlotCounts
  onRemoveModule?: (index: number) => void
  onToggleOffline?: (index: number) => void
  onRemoveDrone?: (index: number) => void
  onRemoveFighter?: (index: number) => void
  onRemoveCargo?: (index: number) => void
  onAddModule?: (slotType: string) => void
  onSectionClick?: (slotType: string) => void
  highlightedSection?: string | null
  className?: string
  slotHistory?: Record<string, any>
}

const SLOT_CONFIG = {
  high: {
    label: 'High Slots',
    color: 'bg-red-500',
    glow: 'shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    border: 'border-red-500/30',
    text: 'text-red-400',
    sectionId: 'high'
  },
  med: {
    label: 'Medium Slots',
    color: 'bg-blue-500',
    glow: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    sectionId: 'med'
  },
  low: {
    label: 'Low Slots',
    color: 'bg-yellow-500',
    glow: 'shadow-[0_0_8px_rgba(234,179,8,0.5)]',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    sectionId: 'low'
  },
  rig: {
    label: 'Rig Slots',
    color: 'bg-teal-500',
    glow: 'shadow-[0_0_8px_rgba(20,184,166,0.5)]',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    sectionId: 'rig'
  },
  subsystem: {
    label: 'Subsystems',
    color: 'bg-purple-500',
    glow: 'shadow-[0_0_8px_rgba(168,85,247,0.5)]',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    sectionId: 'subsystem'
  }
}

export const FitModuleList: React.FC<FitModuleListProps> = ({ 
  modules, 
  drones, 
  fighters = [],
  cargo, 
  slotCounts,
  onRemoveModule,
  onToggleOffline,
  onRemoveDrone,
  onRemoveFighter,
  onRemoveCargo,
  onSectionClick,
  highlightedSection,
  className,
  slotHistory
}) => {
  const moduleTypeId = (module: Module) =>
    Number(module.typeId || (typeof module.id === 'number' ? module.id : 0))

  const groupedModules = {
    high: modules.filter(m => m.slot === 'high').map((m, i) => ({ ...m, originalIndex: modules.indexOf(m) })),
    med: modules.filter(m => m.slot === 'med').map((m, i) => ({ ...m, originalIndex: modules.indexOf(m) })),
    low: modules.filter(m => m.slot === 'low').map((m, i) => ({ ...m, originalIndex: modules.indexOf(m) })),
    rig: modules.filter(m => m.slot === 'rig').map((m, i) => ({ ...m, originalIndex: modules.indexOf(m) })),
    subsystem: modules.filter(m => m.slot === 'subsystem').map((m, i) => ({ ...m, originalIndex: modules.indexOf(m) }))
  }

  const getSlotsForType = (type: 'high' | 'med' | 'low' | 'rig' | 'subsystem') => {
    if (!slotCounts) return 0
    if (type === 'subsystem') return 0
    const slot = slotCounts[type as keyof SlotCounts]
    if (typeof slot === 'object' && slot !== null) {
      return slot.total
    }
    return (slot as number) || 0
  }

  const EmptySlot = ({ type, index, onAdd }: { type: string, index: number, onAdd?: () => void }) => {
    const config = SLOT_CONFIG[type as keyof typeof SLOT_CONFIG] || SLOT_CONFIG.high
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={cn(
          "flex items-center gap-3 p-2 rounded-xl border border-dashed transition-all cursor-pointer group",
          "border-white/5 hover:border-white/10 hover:bg-white/[0.02]",
          highlightedSection === type && config.border
        )}
        onClick={onAdd}
      >
        <div className={cn("w-10 h-10 rounded-lg border flex items-center justify-center", config.border, config.glow.replace('shadow-', 'bg-').replace('[0_0_8px', '/10'))}>
          <Circle className={cn("w-4 h-4", config.text, "opacity-50")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-zinc-600 font-black uppercase tracking-tight">
            Empty {config.label.replace(' Slots', '')} {index + 1}
          </div>
        </div>
        <div className="w-8" />
      </motion.div>
    )
  }

  const FilledSlot = ({ 
    module, 
    index, 
    onRemove, 
    onToggle, 
    type,
    slotHistory
  }: { 
    module: any, 
    index: number, 
    onRemove?: (idx: number) => void, 
    onToggle?: (idx: number) => void,
    type: string,
    slotHistory?: any
  }) => {
    const config = SLOT_CONFIG[type as keyof typeof SLOT_CONFIG] || SLOT_CONFIG.high
    const histKey = `${type}-${index}`
    const history = slotHistory?.[histKey]

    const content = (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.03 }}
        className={cn(
          "group flex items-center gap-3 p-2 rounded-xl border transition-all",
          module.offline ? "border-red-900/20 bg-red-950/10" : "border-white/[0.03] bg-black/40 hover:bg-zinc-900/60 hover:border-blue-500/20",
          highlightedSection === type && config.border
        )}
      >
        <div className={cn("w-10 h-10 rounded-lg bg-black border flex items-center justify-center overflow-hidden relative", config.border)}>
          <Image 
            src={`https://images.evetech.net/types/${moduleTypeId(module)}/icon?size=64`} 
            alt={module.name}
            width={64}
            height={64}
            className={cn("w-full h-full transition-opacity", module.offline ? "opacity-40 grayscale" : "opacity-80 group-hover:opacity-100")}
          />
          {module.offline && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
              <span className="text-[6px] font-black text-red-500">OFF</span>
            </div>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className={cn(
            "text-[11px] truncate font-black uppercase tracking-tight",
            module.offline ? "text-zinc-500 line-through" : "text-zinc-200 group-hover:text-white"
          )}>
            {module.name}
          </div>
          <div className="flex items-center gap-2">
            {module.charge && (
              <span className="text-[7px] text-orange-400 font-mono bg-orange-500/10 px-1 py-0.5 rounded">
                {module.charge.name}
              </span>
            )}
            <span className="text-[8px] text-zinc-600 font-mono">{index + 1}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onToggle && (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggle(module.originalIndex); }}
              className={cn(
                "p-1.5 rounded-md border transition-all",
                module.offline ? "bg-green-500/10 border-green-500/20 text-green-500" : "bg-zinc-800 border-white/5 text-zinc-500 hover:text-white"
              )}
              title={module.offline ? "Online" : "Offline"}
            >
              <Power className="w-3.5 h-3.5" />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onRemove?.(module.originalIndex); }}
            className="p-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-all"
            title="Remove"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>
    )

    if (history) {
      return (
        <TooltipProvider>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              {content}
            </TooltipTrigger>
            <TooltipContent 
              side="right" 
              className="p-0 border-none bg-transparent shadow-none"
              sideOffset={10}
            >
              <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-lg overflow-hidden min-w-[280px] shadow-2xl">
                <div className="px-3 py-2 bg-white/5 border-b border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white italic">{module.name}</p>
                  <p className="text-[8px] text-zinc-500 uppercase tracking-tighter">Performance Analysis & Modifiers</p>
                </div>
                <div className="p-3 flex flex-col gap-3">
                  {Object.entries(history).map(([attr, hist]: [string, any]) => (
                    <div key={attr} className="flex flex-col gap-1">
                      <div className="flex justify-between items-end">
                        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{attr}</span>
                        <span className="text-xs font-black text-white">{(hist as any).final.toLocaleString()}</span>
                      </div>
                      <ModifierBreakdown 
                        history={history} 
                        historyKey={attr}
                        showTotal={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return content
  }

  const SlotSection = ({ 
    type, 
    items, 
    totalSlots,
    onRemove, 
    onToggle,
    onAdd,
    slotHistory
  }: { 
    type: 'high' | 'med' | 'low' | 'rig' | 'subsystem'
    items: any[]
    totalSlots?: number
    onRemove?: (idx: number) => void
    onToggle?: (idx: number) => void
    onAdd?: () => void
    slotHistory?: any
  }) => {
    const config = SLOT_CONFIG[type]
    const slots = totalSlots || 0
    const showEmptySlots = slots > 0
    
    const emptySlots = showEmptySlots ? Math.max(0, slots - items.length) : 0
    const hasContent = items.length > 0 || emptySlots > 0

    if (!hasContent && type !== 'subsystem') return null
    if (type === 'subsystem' && items.length === 0) return null

    return (
      <div 
        className={cn(
          "space-y-2 p-3 rounded-2xl border transition-all",
          highlightedSection === type ? "bg-white/[0.02] border-white/10" : "bg-black/20 border-transparent",
          hasContent && "cursor-pointer hover:bg-white/[0.01]"
        )}
        onClick={() => onSectionClick?.(config.sectionId)}
        id={`section-${config.sectionId}`}
      >
        <div className="flex items-center gap-2 px-1">
          <div className={cn("w-1 h-4 rounded-full", config.color, config.glow)} />
          <h3 className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>{config.label}</h3>
          {showEmptySlots && (
            <span className="text-[9px] text-zinc-600 font-mono ml-auto">
              {items.length}/{slots}
            </span>
          )}
        </div>
        
        <div className="space-y-1">
          {items.map((item, idx) => (
            <FilledSlot
              key={`${item.typeId || item.id}-${idx}`}
              module={item}
              index={idx}
              onRemove={onRemove}
              onToggle={onToggle}
              type={type}
              slotHistory={slotHistory}
            />
          ))}
          
          {Array.from({ length: emptySlots }).map((_, idx) => (
            <EmptySlot 
              key={`empty-${idx}`} 
              type={type} 
              index={items.length + idx}
              onAdd={onAdd}
            />
          ))}
        </div>
      </div>
    )
  }

  const DroneSection = ({ items, onRemove, type }: { items: Drone[], onRemove?: (idx: number) => void, type: 'drone' | 'fighter' }) => {
    const config = type === 'drone' 
      ? { label: 'Drone Bay', color: 'bg-green-500', glow: 'shadow-[0_0_8px_rgba(34,197,94,0.5)]', border: 'border-green-500/30', text: 'text-green-400' }
      : { label: 'Fighter Bay', color: 'bg-orange-500', glow: 'shadow-[0_0_8px_rgba(249,115,22,0.5)]', border: 'border-orange-500/30', text: 'text-orange-400' }

    if (items.length === 0) return null

    return (
      <div className="space-y-2 p-3 rounded-2xl bg-black/20">
        <div className="flex items-center gap-2 px-1">
          <div className={cn("w-1 h-4 rounded-full", config.color, config.glow)} />
          <h3 className={cn("text-[10px] font-black uppercase tracking-widest", config.text)}>{config.label}</h3>
          <span className="text-[9px] text-zinc-600 font-mono ml-auto">{items.length} types</span>
        </div>
        
        <div className="grid grid-cols-2 gap-1">
          {items.map((item, idx) => (
            <motion.div
              key={`drone-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.03 }}
              className="group flex items-center gap-2 p-2 bg-black/40 rounded-lg border border-white/[0.03] hover:border-green-500/20 transition-all"
            >
              <div className="w-8 h-8 rounded bg-black border border-green-500/20 overflow-hidden">
                <Image 
                  src={`https://images.evetech.net/types/${item.id || 0}/icon?size=32`} 
                  alt={item.name}
                  width={32}
                  height={32}
                  className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] text-zinc-300 truncate font-bold">{item.name}</div>
                <div className="text-[8px] text-green-500 font-mono">x{item.quantity}</div>
              </div>
              <button 
                onClick={() => onRemove?.(idx)}
                className="p-1 opacity-0 group-hover:opacity-100 rounded bg-red-500/10 text-red-500 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  const CargoSection = ({ items, onRemove }: { items: CargoItem[], onRemove?: (idx: number) => void }) => {
    if (items.length === 0) return null

    return (
      <div className="space-y-2 p-3 rounded-2xl bg-black/20">
        <div className="flex items-center gap-2 px-1">
          <div className="w-1 h-4 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
          <h3 className="text-[10px] font-black uppercase tracking-widest text-orange-400">Cargo Hold</h3>
          <span className="text-[9px] text-zinc-600 font-mono ml-auto">{items.length} items</span>
        </div>
        
        <div className="grid grid-cols-3 gap-1">
          {items.map((item, idx) => (
            <motion.div
              key={`cargo-${idx}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.02 }}
              className="group flex flex-col items-center gap-1 p-2 bg-black/40 rounded-lg border border-white/[0.03] hover:border-orange-500/20 transition-all"
            >
              <div className="w-8 h-8 rounded bg-black border border-orange-500/20 overflow-hidden">
                <Image 
                  src={`https://images.evetech.net/types/${item.id || 0}/icon?size=32`} 
                  alt={item.name}
                  width={32}
                  height={32}
                  className="w-full h-full opacity-70 group-hover:opacity-100 transition-opacity"
                />
              </div>
              <div className="text-[7px] text-zinc-400 text-center truncate w-full">{item.name}</div>
              <div className="text-[8px] text-orange-500 font-mono">x{item.quantity}</div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className={cn("h-full pr-4", className)}>
      <div className="space-y-3 pb-12">
        <SlotSection type="high" items={groupedModules.high} totalSlots={getSlotsForType('high')} onRemove={onRemoveModule} onToggle={onToggleOffline} onAdd={() => onSectionClick?.('high')} slotHistory={slotHistory} />
        <SlotSection type="med" items={groupedModules.med} totalSlots={getSlotsForType('med')} onRemove={onRemoveModule} onToggle={onToggleOffline} onAdd={() => onSectionClick?.('med')} slotHistory={slotHistory} />
        <SlotSection type="low" items={groupedModules.low} totalSlots={getSlotsForType('low')} onRemove={onRemoveModule} onToggle={onToggleOffline} onAdd={() => onSectionClick?.('low')} slotHistory={slotHistory} />
        <SlotSection type="rig" items={groupedModules.rig} totalSlots={getSlotsForType('rig')} onRemove={onRemoveModule} onToggle={onToggleOffline} onAdd={() => onSectionClick?.('rig')} slotHistory={slotHistory} />
        <SlotSection type="subsystem" items={groupedModules.subsystem} onRemove={onRemoveModule} onToggle={onToggleOffline} slotHistory={slotHistory} />
        
        <div className="flex gap-3">
          <div className="flex-1">
            <DroneSection items={drones} onRemove={onRemoveDrone} type="drone" />
          </div>
        </div>
        
        <CargoSection items={cargo} onRemove={onRemoveCargo} />
      </div>
    </ScrollArea>
  )
}
