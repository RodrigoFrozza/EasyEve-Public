'use client'

import React, { useCallback } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { getTypeIconUrl } from '@/lib/sde'
import { Module, Drone, CargoItem } from '@/types/fit'
import { ModuleInfo } from './modules/types'
import { Zap, Trash2, AlertTriangle, Plus, Bot, Package } from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useTranslations } from '@/i18n/hooks'

type SlotType = 'high' | 'med' | 'low' | 'rig' | 'subsystem'

interface SlotRacksProps {
  slots: { high: number; med: number; low: number; rig: number; subsystem?: number }
  fittedModules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
  onModuleAdd: (slotType: SlotType, index: number) => void
  onModuleRemove: (slotType: SlotType, index: number) => void
  onModuleRightClick: (slotType: SlotType, index: number, module: Module) => void
  onModuleDrop: (slotType: SlotType, index: number, module: ModuleInfo) => void
  onRemoveDrone: (index: number) => void
  onRemoveCargo: (index: number) => void
  highlightedSection?: 'high' | 'med' | 'low' | 'rig' | null
  slotErrors?: Record<string, string[]>
  compatibilityMap?: Record<number, { isCompatible: boolean; restriction?: string }>
}

const SLOT_META: Record<SlotType, { dot: string; text: string; activeBorder: string }> = {
  high: { dot: 'bg-red-500', text: 'text-red-400', activeBorder: 'border-red-500/50' },
  med: { dot: 'bg-blue-500', text: 'text-blue-400', activeBorder: 'border-blue-500/50' },
  low: { dot: 'bg-amber-500', text: 'text-amber-400', activeBorder: 'border-amber-500/50' },
  rig: { dot: 'bg-teal-500', text: 'text-teal-400', activeBorder: 'border-teal-500/50' },
  subsystem: { dot: 'bg-violet-500', text: 'text-violet-400', activeBorder: 'border-violet-500/50' },
}

const RACK_ORDER: SlotType[] = ['high', 'med', 'low', 'rig', 'subsystem']

function modulesForSlot(modules: Module[], type: SlotType): Module[] {
  return modules.filter((m) => m.slot === type)
}

export const SlotRacks: React.FC<SlotRacksProps> = ({
  slots,
  fittedModules,
  drones,
  cargo,
  onModuleAdd,
  onModuleRemove,
  onModuleRightClick,
  onModuleDrop,
  onRemoveDrone,
  onRemoveCargo,
  highlightedSection,
  slotErrors = {},
  compatibilityMap,
}) => {
  const { t } = useTranslations()

  const handleDrop = useCallback(
    (type: SlotType, index: number, e: React.DragEvent) => {
      e.preventDefault()
      const data = e.dataTransfer.getData('module')
      if (!data) return
      try {
        onModuleDrop(type, index, JSON.parse(data) as ModuleInfo)
      } catch (err) {
        console.error('Failed to parse dropped module', err)
      }
    },
    [onModuleDrop]
  )

  const renderRack = (type: SlotType) => {
    const total = type === 'subsystem' ? slots.subsystem ?? 0 : slots[type]
    const sectionModules = modulesForSlot(fittedModules, type)
    // Overflow: a module can carry a slotIndex beyond the hull's capacity (e.g.
    // after switching to a smaller hull). Render enough rows to show them so the
    // problem is visible (regra 3) instead of dropping them off-screen.
    const maxIndex = sectionModules.reduce((max, m) => Math.max(max, m.slotIndex ?? 0), -1)
    const rowCount = Math.max(total, maxIndex + 1)
    if (rowCount === 0) return null

    const meta = SLOT_META[type]
    const kind = t(`fits.rackLabels.slotKind.${type}`)

    return (
      <div key={type} className="space-y-1">
        <div className="flex items-center gap-2 px-1">
          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', meta.dot)} />
          <span className={cn('text-[11px] font-semibold uppercase tracking-wide', meta.text)}>{kind}</span>
          <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
            {sectionModules.length}/{total}
          </span>
        </div>

        <div className="space-y-1">
          {Array.from({ length: rowCount }).map((_, index) => {
            const module = sectionModules.find((m) => (m.slotIndex ?? 0) === index)
            const isOverflow = index >= total
            const slotKey = `${type}-${index}`
            const errors = slotErrors[slotKey]
            const hasError = (errors && errors.length > 0) || isOverflow

            if (!module) {
              const highlighted = highlightedSection === type
              return (
                <button
                  key={slotKey}
                  type="button"
                  onClick={() => onModuleAdd(type, index)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => handleDrop(type, index, e)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border border-dashed px-2 py-1.5 text-left transition-colors',
                    highlighted
                      ? cn(meta.activeBorder, 'bg-muted/40')
                      : 'border-border/60 hover:border-border hover:bg-muted/30'
                  )}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-border/50 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t('fits.rackLabels.emptySlot', { kind })}
                  </span>
                </button>
              )
            }

            const typeId = module.typeId
            const compat = compatibilityMap?.[typeId]
            const incompatible = compat && compat.isCompatible === false
            const canHaveCharge = type === 'high' || type === 'med' || !!module.charge

            const row = (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(type, index, e)}
                className={cn(
                  'group/row flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors',
                  hasError
                    ? 'border-destructive/50 bg-destructive/5'
                    : incompatible
                      ? 'border-amber-500/40 bg-amber-500/5'
                      : 'border-border/70 bg-card/60 hover:bg-muted/30',
                  module.offline && 'opacity-50'
                )}
              >
                <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-border/50 bg-muted/40">
                  <Image
                    src={getTypeIconUrl(typeId, 32)}
                    alt={module.name || 'Module'}
                    width={24}
                    height={24}
                    className="h-full w-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">{module.name}</span>
                    {module.offline && (
                      <span className="shrink-0 rounded bg-muted px-1 text-[9px] uppercase text-muted-foreground">
                        off
                      </span>
                    )}
                  </div>
                  {module.charge?.name && (
                    <span className="flex items-center gap-1 truncate text-[10px] text-amber-500/90">
                      <Zap className="h-2.5 w-2.5 shrink-0" />
                      {module.charge.name}
                    </span>
                  )}
                </div>

                {hasError && (
                  <TooltipProvider>
                    <Tooltip delayDuration={100}>
                      <TooltipTrigger asChild>
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                      </TooltipTrigger>
                      <TooltipContent side="left" className="max-w-xs">
                        {isOverflow
                          ? t('fits.rackLabels.slotOverflowHint')
                          : (errors || []).join(' · ')}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                <div className="flex shrink-0 items-center gap-0.5">
                  {canHaveCharge && (
                    <button
                      type="button"
                      onClick={() => onModuleRightClick(type, index, module)}
                      title={t('fits.rackLabels.selectCharge')}
                      className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-amber-500/15 hover:text-amber-500 group-hover/row:opacity-100"
                    >
                      <Zap className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onModuleRemove(type, index)}
                    title={t('fits.rackLabels.removeModule')}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover/row:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            )

            return (
              <ContextMenu key={slotKey}>
                <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
                <ContextMenuContent className="min-w-[180px]">
                  {canHaveCharge && (
                    <ContextMenuItem onClick={() => onModuleRightClick(type, index, module)}>
                      <Zap className="mr-2 h-3.5 w-3.5" />
                      {t('fits.rackLabels.selectCharge')}
                    </ContextMenuItem>
                  )}
                  {canHaveCharge && <ContextMenuSeparator />}
                  <ContextMenuItem
                    onClick={() => onModuleRemove(type, index)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    {t('fits.rackLabels.removeModule')}
                  </ContextMenuItem>
                </ContextMenuContent>
              </ContextMenu>
            )
          })}
        </div>
      </div>
    )
  }

  const renderBay = (
    label: string,
    emptyLabel: string,
    icon: React.ReactNode,
    items: Array<{ id?: number; name: string; quantity: number }>,
    onRemove: (index: number) => void
  ) => (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, index) => {
            const typeId = item.id
            return (
              <div
                key={`${item.name}-${index}`}
                className="group/row flex items-center gap-2 rounded-md border border-border/70 bg-card/60 px-2 py-1.5 hover:bg-muted/30"
              >
                {typeId ? (
                  <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded border border-border/50 bg-muted/40">
                    <Image src={getTypeIconUrl(typeId, 32)} alt={item.name} width={24} height={24} className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <span className="h-6 w-6 shrink-0 rounded border border-border/50 bg-muted/40" />
                )}
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{item.name}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">x{item.quantity || 1}</span>
                <button
                  type="button"
                  onClick={() => onRemove(index)}
                  title={t('fits.rackLabels.removeModule')}
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover/row:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  return (
    <div className="flex flex-col gap-3">
      {RACK_ORDER.map((type) => renderRack(type))}

      {renderBay(
        t('fits.rackLabels.sectionDrones'),
        t('fits.rackLabels.dronesEmpty'),
        <Bot className="h-3.5 w-3.5" />,
        drones,
        onRemoveDrone
      )}

      {renderBay(
        t('fits.rackLabels.sectionCargo'),
        t('fits.rackLabels.cargoEmpty'),
        <Package className="h-3.5 w-3.5" />,
        cargo,
        onRemoveCargo
      )}
    </div>
  )
}
