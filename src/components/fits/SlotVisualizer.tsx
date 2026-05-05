'use client'

import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Module } from '@/types/fit'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Crosshair,
  MousePointer2,
  Ship
} from 'lucide-react'

interface SlotVisualizerProps {
  shipId: number
  shipName: string
  slots: {
    high: number
    med: number
    low: number
    rig: number
    service?: number
  }
  fittedModules: Module[]
  onSlotClick?: (slotType: string, index: number) => void
  onSectionClick?: (slotType: string) => void
  calculating?: boolean
  highlightedSection?: string | null
}

interface SlotDot {
  type: 'high' | 'med' | 'low' | 'rig' | 'service'
  index: number
  filled: boolean
  moduleName?: string
  x: number
  y: number
}

const SLOT_COLORS = {
  high: {
    filled: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    empty: 'bg-red-500/30 border border-red-500/50',
    glow: 'shadow-[0_0_12px_rgba(239,68,68,0.8)]'
  },
  med: {
    filled: 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]',
    empty: 'bg-blue-500/30 border border-blue-500/50',
    glow: 'shadow-[0_0_12px_rgba(59,130,246,0.8)]'
  },
  low: {
    filled: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
    empty: 'bg-yellow-500/30 border border-yellow-500/50',
    glow: 'shadow-[0_0_12px_rgba(234,179,8,0.8)]'
  },
  rig: {
    filled: 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.6)]',
    empty: 'bg-teal-500/30 border border-teal-500/50',
    glow: 'shadow-[0_0_12px_rgba(20,184,166,0.8)]'
  },
  service: {
    filled: 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]',
    empty: 'bg-purple-500/30 border border-purple-500/50',
    glow: 'shadow-[0_0_12px_rgba(168,85,247,0.8)]'
  }
}

export const SlotVisualizer: React.FC<SlotVisualizerProps> = ({
  shipId,
  shipName,
  slots,
  fittedModules,
  onSlotClick,
  onSectionClick,
  calculating = false,
  highlightedSection = null
}) => {
  const [hoveredDot, setHoveredDot] = useState<SlotDot | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [imgError, setImgError] = useState(false)

  const handleImgError = () => setImgError(true)

  const dots = useMemo(() => {
    const result: SlotDot[] = []
    
    const createDotPositions = (type: 'high' | 'med' | 'low' | 'rig' | 'service', count: number, basePositions: { x: number, y: number }[]) => {
      for (let i = 0; i < count; i++) {
        const fittedModule = fittedModules.find(m => {
          const slotType = m.slot === 'med' ? 'med' : m.slot
          return slotType === type && m.slotIndex === i
        })
        
        const basePos = basePositions[i % basePositions.length]
        const offsetX = Math.floor(i / basePositions.length) * (type === 'rig' ? 12 : 15)
        
        result.push({
          type,
          index: i,
          filled: !!fittedModule,
          moduleName: fittedModule?.name,
          x: basePos.x + offsetX,
          y: basePos.y
        })
      }
    }

    createDotPositions('high', slots.high, [
      { x: 35, y: 15 }, { x: 45, y: 12 }, { x: 55, y: 12 }, { x: 65, y: 15 },
      { x: 32, y: 25 }, { x: 68, y: 25 }, { x: 30, y: 35 }, { x: 70, y: 35 }
    ])
    
    createDotPositions('med', slots.med, [
      { x: 25, y: 45 }, { x: 35, y: 42 }, { x: 65, y: 42 }, { x: 75, y: 45 },
      { x: 22, y: 55 }, { x: 78, y: 55 }
    ])
    
    createDotPositions('low', slots.low, [
      { x: 28, y: 65 }, { x: 40, y: 62 }, { x: 60, y: 62 }, { x: 72, y: 65 },
      { x: 25, y: 75 }, { x: 35, y: 78 }, { x: 65, y: 78 }, { x: 75, y: 75 }
    ])
    
    createDotPositions('rig', slots.rig, [
      { x: 40, y: 85 }, { x: 50, y: 87 }, { x: 60, y: 85 }
    ])

    if (slots.service) {
      createDotPositions('service', slots.service, [
        { x: 35, y: 92 }, { x: 50, y: 94 }, { x: 65, y: 92 }
      ])
    }

    return result
  }, [slots, fittedModules])

  const handleDotHover = (dot: SlotDot | null, event?: React.MouseEvent) => {
    setHoveredDot(dot)
    if (dot && event) {
      const rect = event.currentTarget.getBoundingClientRect()
      setTooltipPos({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      })
    }
  }

  const getSectionForDot = (dot: SlotDot) => {
    switch (dot.type) {
      case 'high': return 'high'
      case 'med': return 'med'
      case 'low': return 'low'
      case 'rig': return 'rig'
      case 'service': return 'service'
      default: return ''
    }
  }

  return (
    <div className="relative w-full aspect-[4/3] bg-black/60 rounded-2xl overflow-hidden border border-white/5 group">
      {/* Ship Image */}
      <div className={cn(
        "absolute inset-0 flex items-center justify-center transition-all duration-500",
        calculating && "scale-[0.98] blur-[1px]"
      )}>
        {imgError ? (
          <Ship className="w-1/2 h-1/2 text-zinc-700 opacity-50" />
        ) : (
          <Image
            src={`https://images.evetech.net/types/${shipId}/render?size=512`}
            alt={shipName}
            width={512}
            height={512}
            className={cn(
              "w-full h-full object-contain p-8 transition-all duration-700",
              "group-hover:scale-105",
              calculating && "scale-[0.98]"
            )}
            onError={handleImgError}
          />
        )}
      </div>

      {/* Slot Dots Overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{ perspective: '1000px' }}
      >
        {dots.map((dot, i) => {
          const colors = SLOT_COLORS[dot.type]
          const isHighlighted = highlightedSection === dot.type
          const isOtherHighlighted = highlightedSection && highlightedSection !== dot.type
          
          return (
            <motion.button
              key={`${dot.type}-${dot.index}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02, duration: 0.3 }}
              className={cn(
                "absolute w-3 h-3 rounded-full transition-all duration-300 pointer-events-auto",
                "hover:scale-150 hover:z-50 cursor-pointer",
                dot.filled ? colors.filled : colors.empty,
                isHighlighted && colors.glow,
                isOtherHighlighted && "opacity-30",
                calculating && "animate-pulse"
              )}
              style={{
                left: `${dot.x}%`,
                top: `${dot.y}%`,
                transform: 'translate(-50%, -50%)'
              }}
              onMouseEnter={(e) => handleDotHover(dot, e)}
              onMouseLeave={() => handleDotHover(null)}
              onClick={() => onSectionClick?.(getSectionForDot(dot))}
            />
          )
        })}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 flex items-center gap-3 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/5">
        {[
          { type: 'high', label: 'HI' },
          { type: 'med', label: 'MED' },
          { type: 'low', label: 'LOW' },
          { type: 'rig', label: 'RIG' },
        ].map(slot => (
          <button
            key={slot.type}
            onClick={() => onSectionClick?.(slot.type)}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-[9px] font-black tracking-wider",
              highlightedSection === slot.type 
                ? "bg-white/10 text-white" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
            )}
          >
            <div className={cn(
              "w-2 h-2 rounded-full",
              SLOT_COLORS[slot.type as keyof typeof SLOT_COLORS].filled
            )} />
            <span>{slot.label}</span>
          </button>
        ))}
      </div>

      {/* Ship Info */}
      <div className="absolute top-3 right-3 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg border border-white/5">
        <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{shipName}</span>
        {calculating && (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="w-3 h-3 rounded-full border border-blue-500/30 border-t-blue-500"
          />
        )}
      </div>

      {/* Tooltip */}
      <AnimatePresence>
        {hoveredDot && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltipPos.x,
              top: tooltipPos.y,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap",
              "border shadow-xl backdrop-blur-sm",
              hoveredDot.filled 
                ? "bg-zinc-900/95 border-white/20 text-white" 
                : "bg-zinc-800/95 border-white/10 text-zinc-400"
            )}>
              {hoveredDot.filled ? (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    SLOT_COLORS[hoveredDot.type].filled
                  )} />
                  <span className="max-w-[150px] truncate">{hoveredDot.moduleName}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    SLOT_COLORS[hoveredDot.type].empty
                  )} />
                  <span>Empty {hoveredDot.type.toUpperCase()} {hoveredDot.index + 1}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {shipId === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
          <Crosshair className="w-12 h-12 text-zinc-700 mb-3" />
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Select Ship to Begin</span>
        </div>
      )}
    </div>
  )
}
