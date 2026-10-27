'use client'

import React, { useState, useMemo, useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Module, ShipStats } from '@/types/fit'
import { ModuleInfo } from './modules/types'
import { motion, AnimatePresence } from 'framer-motion'
import { Ship, Shield, Zap, AlertTriangle, Trash2, X } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
import { ModifierBreakdown } from './ModifierBreakdown'
import { useTranslations } from '@/i18n/hooks'

type SlotType = 'high' | 'med' | 'low' | 'rig'

interface CircularSlotVisualizerProps {
  shipId: number
  shipName: string
  slots: {
    high: number
    med: number
    low: number
    rig: number
  }
  fittedModules: Module[]
  cpuUsed?: number
  cpuTotal?: number
  powerUsed?: number
  powerTotal?: number
  capacitorStable?: boolean
  capacitorPercent?: number
  onSlotClick?: (slotType: SlotType, index: number) => void
  onModuleRemove?: (slotType: SlotType, index: number) => void
  onModuleAdd?: (slotType: SlotType, index: number) => void
  onModuleRightClick?: (slotType: SlotType, index: number, module: Module) => void
  onModuleDrop?: (slotType: SlotType, index: number, module: ModuleInfo) => void
  highlightedSection?: SlotType | null
  calculating?: boolean
  size?: number
  slotHistory?: ShipStats['slotHistory']
  slotErrors?: Record<string, string[]>
  /** Hull compatibility from `/api/modules/compatibility` (typeId → row). */
  compatibilityMap?: Record<number, { isCompatible: boolean; restriction?: string }>
}

interface PositionedSlot {
  type: SlotType
  index: number
  x: number
  y: number
  angle: number
  fitted: boolean
  overflow: boolean
  module?: Module
}

const SLOT_COLORS: Record<SlotType, { main: string; glow: string; border: string }> = {
  high: { main: 'bg-red-500/90', glow: 'shadow-[0_0_10px_rgba(239,68,68,0.35)]', border: 'border-red-400/70' },
  med: { main: 'bg-blue-500/90', glow: 'shadow-[0_0_10px_rgba(59,130,246,0.35)]', border: 'border-blue-400/70' },
  low: { main: 'bg-amber-500/90', glow: 'shadow-[0_0_10px_rgba(245,158,11,0.35)]', border: 'border-amber-400/70' },
  rig: { main: 'bg-teal-500/90', glow: 'shadow-[0_0_10px_rgba(20,184,166,0.35)]', border: 'border-teal-400/70' }
}

const SLOT_KIND_I18N: Record<SlotType, string> = {
  high: 'fits.rackLabels.slotKind.high',
  med: 'fits.rackLabels.slotKind.med',
  low: 'fits.rackLabels.slotKind.low',
  rig: 'fits.rackLabels.slotKind.rig',
}

function calculateSlotPositions(
  slots: { high: number; med: number; low: number; rig: number },
  fittedModules: Module[],
  centerX: number,
  centerY: number,
  radius: number,
  slotPx: number,
  layoutSize: number
): PositionedSlot[] {
  const result: PositionedSlot[] = []
  const slotMargin = 6
  const minChord = slotPx + slotMargin

  // EVE Standard Quadrants
  const sections: { type: SlotType; startAngle: number; endAngle: number }[] = [
    { type: 'high', startAngle: 45, endAngle: 135 },   // Top
    { type: 'med', startAngle: 315, endAngle: 405 },   // Right (wraps)
    { type: 'low', startAngle: 225, endAngle: 315 },   // Bottom
    { type: 'rig', startAngle: 135, endAngle: 225 }    // Left
  ]

  for (const section of sections) {
    const count = slots[section.type]
    if (count === 0) continue

    let angleSpan = section.endAngle - section.startAngle
    if (angleSpan < 0) angleSpan += 360 // Handle wraparound for med slots
    
    const usableSpan = angleSpan - 8 
    const centerAngle = (section.startAngle + section.endAngle) / 2
    
    const preferredAngleStep = 11 
    let angleStep = preferredAngleStep
    if ((count - 1) * angleStep > usableSpan) {
      angleStep = usableSpan / (count - 1 || 1)
    }

    const startAngle = centerAngle - ((count - 1) * angleStep) / 2
    const baseRadius = radius
    let radiusAdjusted = count > 6 ? baseRadius * (1 + (count - 6) * 0.02) : baseRadius

    // Ensure neighbouring slot centres are far enough apart for slotPx (small rack sizes).
    const stepRad = (angleStep * Math.PI) / 180
    const half = stepRad / 2
    if (half > 0 && half < Math.PI / 2) {
      const needR = minChord / (2 * Math.sin(half))
      if (needR > radiusAdjusted) radiusAdjusted = needR
    }
    radiusAdjusted = Math.min(radiusAdjusted, layoutSize * 0.46)

    for (let i = 0; i < count; i++) {
      let angleDeg = startAngle + (i * angleStep)
      if (angleDeg >= 360) angleDeg -= 360 // Normalize back to 0-360
      
      const angleRad = (angleDeg * Math.PI) / 180

      const fittedModule = fittedModules.find(m => {
        const slotType = m.slot === 'med' ? 'med' : m.slot
        return slotType === section.type && m.slotIndex === i
      })

      result.push({
        type: section.type,
        index: i,
        x: centerX + Math.cos(angleRad) * radiusAdjusted,
        y: centerY - Math.sin(angleRad) * radiusAdjusted,
        angle: angleDeg,
        fitted: !!fittedModule,
        overflow: false,
        module: fittedModule
      })
    }
  }

  return result
}

export const CircularSlotVisualizer: React.FC<CircularSlotVisualizerProps> = ({
  shipId,
  shipName,
  slots,
  fittedModules,
  cpuUsed = 0,
  cpuTotal = 0,
  powerUsed = 0,
  powerTotal = 0,
  capacitorStable = true,
  capacitorPercent = 100,
  onSlotClick,
  onModuleRemove,
  onModuleAdd,
  onModuleRightClick,
  onModuleDrop,
  highlightedSection,
  calculating = false,
  size = 480,
  slotHistory,
  slotErrors = {},
  compatibilityMap,
}) => {
  const { t } = useTranslations()
  const [hoveredSlot, setHoveredSlot] = useState<PositionedSlot | null>(null)
  const [imgError, setImgError] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  const centerX = size / 2
  const centerY = size / 2
  const shipRadius = size * 0.20
  const slotPx = Math.max(22, Math.min(36, Math.round(size * 0.062)))
  const slotRadius = useMemo(() => {
    const base = size * 0.37
    const bump = size < 440 ? 1 + (440 - size) / 900 : 1
    return base * bump
  }, [size])

  const cpuPercent = cpuTotal > 0 ? (cpuUsed / cpuTotal) * 100 : 0
  const powerPercent = powerTotal > 0 ? (powerUsed / powerTotal) * 100 : 0

  const slotOverflow = useMemo(() => ({
    high: fittedModules.filter(m => m.slot === 'high').length > slots.high,
    med: fittedModules.filter(m => m.slot === 'med').length > slots.med,
    low: fittedModules.filter(m => m.slot === 'low').length > slots.low,
    rig: fittedModules.filter(m => m.slot === 'rig').length > slots.rig
  }), [fittedModules, slots])

  const positionedSlots = useMemo(() => {
    return calculateSlotPositions(slots, fittedModules, centerX, centerY, slotRadius, slotPx, size)
  }, [slots, fittedModules, centerX, centerY, slotRadius, slotPx, size])

  const handleSlotClick = useCallback((slot: PositionedSlot) => {
    if (slot.fitted && onModuleRemove) {
      onModuleRemove(slot.type, slot.index)
    } else if (onModuleAdd) {
      onModuleAdd(slot.type, slot.index)
    }
  }, [onModuleRemove, onModuleAdd])

  const handleSlotDrop = useCallback((slot: PositionedSlot, e: React.DragEvent) => {
    e.preventDefault()
    const data = e.dataTransfer.getData('module')
    if (data && onModuleDrop) {
      try {
        const droppedModule = JSON.parse(data) as ModuleInfo
        onModuleDrop(slot.type, slot.index, droppedModule)
      } catch (err) {
        console.error('Failed to parse dropped module', err)
      }
    }
  }, [onModuleDrop])

  const circumference = 2 * Math.PI * (shipRadius + 16)
  const powerArc = (powerPercent / 100) * circumference
  const cpuArc = (cpuPercent / 100) * circumference

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg
        className="absolute inset-0 -rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <defs>
          <linearGradient id="powerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
            <stop offset="100%" stopColor="rgba(59, 130, 246, 0.2)" />
          </linearGradient>
          <linearGradient id="cpuGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" />
            <stop offset="100%" stopColor="rgba(239, 68, 68, 0.2)" />
          </linearGradient>
          <radialGradient id="centralGlow">
            <stop offset="0%" stopColor="rgba(59, 130, 246, 0.15)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Ambient Central Glow */}
        <circle cx={centerX} cy={centerY} r={shipRadius * 1.5} fill="url(#centralGlow)" />

        {/* Background Tactical Rings */}
        <circle cx={centerX} cy={centerY} r={slotRadius + 35} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" strokeDasharray="4 8" />
        <circle cx={centerX} cy={centerY} r={slotRadius + 28} fill="none" stroke="rgba(255,255,255,0.01)" strokeWidth="10" />
        <circle cx={centerX} cy={centerY} r={slotRadius} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="50" strokeDasharray="1, 12" className="opacity-40" />
        
        {/* Core HUD Rings */}
        <circle cx={centerX} cy={centerY} r={shipRadius + 32} fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
        <circle cx={centerX} cy={centerY} r={shipRadius + 28} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1.5" strokeDasharray="100 200" className="animate-[spin_20s_linear_infinite]" />
        <circle cx={centerX} cy={centerY} r={shipRadius + 24} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />

        {/* CPU & Power Grid HUD Arcs */}
        <motion.circle
          cx={centerX}
          cy={centerY}
          r={shipRadius + 22}
          fill="none"
          stroke="url(#powerGradient)"
          strokeWidth="4"
          strokeDasharray={`${powerArc} ${circumference}`}
          strokeLinecap="round"
          filter="url(#glow)"
          animate={{ strokeDashoffset: circumference - powerArc }}
          transition={{ duration: 1.2, ease: 'circOut' }}
        />

        <motion.circle
          cx={centerX}
          cy={centerY}
          r={shipRadius + 15}
          fill="none"
          stroke="url(#cpuGradient)"
          strokeWidth="4"
          strokeDasharray={`${cpuArc} ${circumference}`}
          strokeLinecap="round"
          filter="url(#glow)"
          animate={{ strokeDashoffset: circumference - cpuArc }}
          transition={{ duration: 1.2, ease: 'circOut', delay: 0.2 }}
        />

        {/* Strategic Grid Ticks */}
        {positionedSlots.map((slot, idx) => (
          <g key={`tick-group-${idx}`}>
            <line
              x1={centerX + Math.cos((slot.angle * Math.PI) / 180) * (slotRadius - 30)}
              y1={centerY - Math.sin((slot.angle * Math.PI) / 180) * (slotRadius - 30)}
              x2={centerX + Math.cos((slot.angle * Math.PI) / 180) * (slotRadius + 30)}
              y2={centerY - Math.sin((slot.angle * Math.PI) / 180) * (slotRadius + 30)}
              stroke={slot.fitted ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)'}
              strokeWidth="0.5"
            />
            {slot.fitted && (
              <circle
                cx={centerX + Math.cos((slot.angle * Math.PI) / 180) * (slotRadius + 35)}
                cy={centerY - Math.sin((slot.angle * Math.PI) / 180) * (slotRadius + 35)}
                r="1.5"
                fill={SLOT_COLORS[slot.type].main.replace('bg-', '')}
                className="opacity-50"
              />
            )}
          </g>
        ))}
      </svg>

      <motion.div
        className={cn(
          "absolute rounded-full overflow-hidden transition-all duration-300",
          "bg-gradient-to-br from-zinc-900 via-black to-zinc-900 shadow-[inset_0_0_50px_rgba(0,0,0,0.9)]",
          "border border-white/5",
          calculating && "scale-[0.97] opacity-60"
        )}
        style={{
          left: centerX - shipRadius,
          top: centerY - shipRadius,
          width: shipRadius * 2,
          height: shipRadius * 2,
        }}
      >
        <div className="relative w-full h-full group">
          {shipId > 1 && !imgError && (
            <>
              <Image
                src={`https://images.evetech.net/types/${shipId}/render?size=512`}
                alt={shipName}
                width={512}
                height={512}
                className={cn(
                  "w-full h-full object-contain transition-all duration-1000",
                  imgLoaded ? "opacity-80 brightness-110 contrast-125" : "opacity-0",
                  "group-hover:scale-110 group-hover:rotate-3"
                )}
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgError(true)}
              />
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  background: [
                    'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)',
                    'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.2) 0%, transparent 70%)',
                    'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.1) 0%, transparent 70%)'
                  ]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            </>
          )}

          {!imgLoaded && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
              <Ship className="w-12 h-12 text-blue-500/20 animate-pulse" />
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {positionedSlots.map((slot, i) => {
          const colors = SLOT_COLORS[slot.type]
          const isHovered = hoveredSlot?.type === slot.type && hoveredSlot?.index === slot.index
          const dimmed = highlightedSection != null && slot.type !== highlightedSection
          const typeId = slot.module?.typeId
          const incompatible =
            typeId != null &&
            compatibilityMap &&
            compatibilityMap[typeId]?.isCompatible === false

          const slotButton = (
            <motion.button
              key={`${slot.type}-${slot.index}`}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02, type: 'spring', stiffness: 200, damping: 15 }}
              className={cn(
                "absolute rounded-lg flex items-center justify-center transition-all duration-300 cursor-pointer",
                "backdrop-blur-xl group/slot overflow-hidden",
                slot.fitted
                   ? cn(colors.border, colors.main, "shadow-md shadow-black/40", colors.glow)
                   : cn("border-border/70 bg-muted/30 hover:bg-muted/45 hover:border-border"),
                 slotErrors[`${slot.type}-${slot.index}`] && "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.8)] animate-pulse z-40",
                 incompatible && "ring-2 ring-amber-500/70 ring-offset-2 ring-offset-zinc-950 z-30",
                 dimmed && "opacity-40 saturate-50",
                 isHovered && "scale-110 z-50 shadow-xl brightness-110"
               )}
              style={{
                left: slot.x,
                top: slot.y,
                width: slotPx,
                height: slotPx,
                borderWidth: '1px',
                transform: 'translate(-50%, -50%)',
                background: slot.fitted ? undefined : 'linear-gradient(135deg, rgba(38,38,45,0.9) 0%, rgba(24,24,29,0.75) 100%)'
              }}
              onMouseEnter={() => setHoveredSlot(slot)}
              onMouseLeave={() => setHoveredSlot(null)}
              onClick={() => handleSlotClick(slot)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => handleSlotDrop(slot, e)}
            >
              {slot.fitted && slot.module ? (
                <div className="relative w-full h-full flex items-center justify-center p-1">
                  <Image
                    src={`https://images.evetech.net/types/${slot.module.typeId}/icon?size=64`}
                    alt={slot.module.name || 'Module'}
                    width={32}
                    height={32}
                    className="w-full h-full object-contain drop-shadow-md group-hover/slot:scale-110 transition-transform"
                  />
                  {slot.module.charge && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-orange-500 rounded-sm border-[1.5px] border-black flex items-center justify-center shadow-sm">
                      <Zap className="w-2 h-2 text-black fill-black" />
                    </div>
                  )}
                  {slot.module.offline && (
                    <div className="absolute inset-0 bg-red-900/40 flex items-center justify-center">
                      <div className="w-full h-[1px] bg-red-500 rotate-45" />
                    </div>
                  )}
                </div>
              ) : (
                <div className={cn("w-1.5 h-1.5 rounded-full opacity-20 transition-all group-hover/slot:scale-150 group-hover/slot:opacity-60", colors.main)} />
              )}
            </motion.button>
          )

          if (slot.fitted && slot.module) {
            const slotKey = `${slot.type}-${slot.index}`
            const history = slotHistory?.[slotKey]
            const errors = slotErrors?.[slotKey]

            return (
              <ContextMenu key={slotKey}>
                <ContextMenuTrigger asChild>
                  <TooltipProvider>
                    <Tooltip delayDuration={0}>
                      <TooltipTrigger asChild>
                        {slotButton}
                      </TooltipTrigger>
                      <TooltipContent 
                        side="top" 
                        align="center"
                        className="p-0 border-none bg-transparent shadow-none"
                        sideOffset={16}
                        collisionPadding={16}
                      >
                        <div className="min-w-[min(100%,20rem)] max-w-[min(22rem,90vw)] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg">
                          {/* Header */}
                          <div className="border-b border-border bg-muted/30 px-3 py-3">
                            <div className="flex items-start gap-3">
                              <div className={cn('shrink-0 rounded-md border border-border bg-background/80 p-1.5')}>
                                <Image
                                  src={`https://images.evetech.net/types/${slot.module.typeId}/icon?size=64`}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="h-8 w-8 object-contain"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                                    {slot.module.name}
                                  </h4>
                                  <Badge variant="outline" className={cn('h-5 shrink-0 border-border px-1.5 text-[10px] font-medium', colors.main.replace('bg-', 'text-'))}>
                                    {t(SLOT_KIND_I18N[slot.type])}
                                  </Badge>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground">
                                  {slot.module.groupName ? (
                                    <span className="min-w-0 break-words font-medium">{slot.module.groupName}</span>
                                  ) : null}
                                  {slot.module.groupName ? <span className="text-border" aria-hidden>·</span> : null}
                                  <span className="font-mono tabular-nums">ID {slot.module.typeId}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Error Section */}
                          {errors && errors.length > 0 && (
                            <div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2.5">
                              <div className="mb-1.5 flex items-center gap-2">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                                <span className="text-xs font-semibold text-destructive">Fitting issue</span>
                              </div>
                              <div className="space-y-1.5">
                                {errors.map((err, idx) => (
                                  <p key={idx} className="flex items-start gap-2 text-xs font-medium leading-snug text-destructive">
                                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-destructive" />
                                    <span className="min-w-0 break-words">{err}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Attributes & Modifiers */}
                          <div className="space-y-3 p-3">
                            {history ? (
                              <div className="space-y-2">
                                {Object.entries(history).map(([attr]) => (
                                  <div key={attr}>
                                    <ModifierBreakdown
                                      history={history}
                                      historyKey={attr}
                                      showTotal
                                      embedded
                                      label={attr}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                                <div className="h-px w-12 bg-border" />
                                <span className="text-xs font-medium text-muted-foreground">{t('fits.rackLabels.noActiveModifiers')}</span>
                              </div>
                            )}
                          </div>

                          {/* Footer */}
                          <div className="flex items-center justify-between border-t border-border bg-muted/20 px-3 py-2">
                            <span className="text-[10px] font-medium text-muted-foreground">{t('fits.rackLabels.hardwareOnline')}</span>
                            <div className="flex items-center gap-2">
                              {slot.module.charge && (
                                <div className="flex items-center gap-1">
                                  <Zap className="h-3 w-3 text-amber-600" />
                                  <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">{t('fits.rackLabels.chargeLoaded')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </ContextMenuTrigger>
                <ContextMenuContent className="bg-zinc-950 border-white/10 text-[10px] min-w-[180px] backdrop-blur-2xl">
                  <div className="px-2 py-1.5 border-b border-white/5 mb-1 bg-white/5">
                    <p className="text-[11px] font-semibold leading-snug text-white line-clamp-2">{slot.module.name}</p>
                    <p className="text-[8px] text-zinc-500 font-medium">
                      {t('fits.rackLabels.slotPosition', {
                        kind: t(SLOT_KIND_I18N[slot.type]),
                        n: slot.index + 1,
                      })}
                    </p>
                  </div>
                  <ContextMenuItem
                    className="flex items-center gap-2 cursor-pointer py-2 focus:bg-orange-500/10 focus:text-orange-400"
                    onClick={() => onModuleRightClick?.(slot.type, slot.index, slot.module!)}
                  >
                    <Zap className="w-3.5 h-3.5" />
                    {t('fits.rackLabels.selectCharge')}
                  </ContextMenuItem>
                  <ContextMenuSeparator className="bg-white/5" />
                  <ContextMenuItem
                    className="flex items-center gap-2 text-red-400 cursor-pointer py-2 focus:bg-red-500/10 focus:text-red-400"
                    onClick={() => onModuleRemove?.(slot.type, slot.index)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {t('fits.rackLabels.removeModule')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          }

          return slotButton
        })}
      </AnimatePresence>

      <div className="absolute top-[-50px] left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="flex flex-col items-center">
          <div className="w-8 h-[1px] bg-blue-500/40 mb-2" />
          <span className="text-[15px] font-semibold tracking-tight text-white drop-shadow-[0_0_10px_rgba(59,130,246,0.35)]">
            {shipName}
          </span>
          <span className="text-[8px] text-zinc-500 font-medium mt-1">{t('fits.rackLabels.selectedHull')}</span>
        </div>
      </div>

      <div className="absolute bottom-[31%] left-1/2 -translate-x-1/2 text-center pointer-events-none">
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-2.5 py-1 backdrop-blur-sm">
          <Zap className={cn("h-3.5 w-3.5", capacitorStable ? "text-primary" : "text-destructive animate-pulse")} />
          <span className={cn(
            "font-mono text-xs font-semibold tabular-nums",
            capacitorStable ? "text-foreground" : "text-destructive"
          )}>
            {Number.isFinite(Number(capacitorPercent)) ? Number(capacitorPercent).toFixed(1) : '0.0'}%
          </span>
        </div>
      </div>

      <AnimatePresence>
        {(slotOverflow.high || slotOverflow.med || slotOverflow.low || slotOverflow.rig) && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-10 left-0 flex items-center gap-3 px-4 py-2 bg-red-600/20 border border-red-500/40 rounded-r-xl backdrop-blur-md z-30 shadow-2xl"
          >
            <div className="relative">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              <div className="absolute inset-0 bg-red-500 blur-lg opacity-40 animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-red-300 tracking-tight">{t('fits.rackLabels.slotOverflowTitle')}</span>
              <span className="text-[8px] text-red-400/80 font-medium">{t('fits.rackLabels.slotOverflowHint')}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
