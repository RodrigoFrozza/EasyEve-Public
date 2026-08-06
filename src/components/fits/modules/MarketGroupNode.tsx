'use client'

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, Package, Folder } from 'lucide-react'
import { MarketGroup, ModuleInfo, SlotType, getMetaGroupDisplay } from './types'
import { SlotBadge } from './SlotBadge'
import { CompatibilityBadge } from './CompatibilityBadge'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import Image from 'next/image'

interface ModuleListItemProps {
  module: ModuleInfo
  compatibility?: {
    isCompatible: boolean
    restriction?: string
  }
  onSelect: (module: ModuleInfo) => void
}

export const ModuleListItem: React.FC<ModuleListItemProps> = ({
  module,
  compatibility,
  onSelect
}) => {
  const metaDisplay = getMetaGroupDisplay(module.metaGroupName, module.metaLevel)
  
  const tooltipContent = (
    <div className="min-w-[200px] max-w-[min(320px,90vw)] space-y-2 text-left">
      <div className="border-b border-border pb-1.5">
        <p className="text-xs font-semibold leading-snug text-foreground">{module.name}</p>
        {module.groupName ? (
          <p className="mt-0.5 text-[11px] text-muted-foreground">{module.groupName}</p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {module.cpu !== undefined && (
          <>
            <span className="text-muted-foreground">CPU</span>
            <span className="font-mono tabular-nums text-foreground">{module.cpu}</span>
          </>
        )}
        {module.powerGrid !== undefined && (
          <>
            <span className="text-muted-foreground">Power grid</span>
            <span className="font-mono tabular-nums text-foreground">{module.powerGrid}</span>
          </>
        )}
        {module.metaLevel !== undefined && (
          <>
            <span className="text-muted-foreground">Meta level</span>
            <span className="font-mono tabular-nums text-foreground">{module.metaLevel}</span>
          </>
        )}
        {module.metaGroupName && (
          <>
            <span className="text-muted-foreground">Meta</span>
            <span className={cn('font-medium', metaDisplay.color)}>{module.metaGroupName}</span>
          </>
        )}
      </div>
    </div>
  )
  
  const [imageLoaded, setImageLoaded] = useState(false)
  
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => onSelect(module)}
            className={cn(
              "group flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors",
              "hover:bg-muted/50",
              compatibility && !compatibility.isCompatible && "opacity-45 grayscale"
            )}
          >
            <div className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border bg-muted/40">
              <Image
                src={`https://images.evetech.net/types/${module.typeId}/icon?size=32`}
                alt={module.name}
                width={28}
                height={28}
                className={cn(
                  "w-full h-full object-cover transition-opacity",
                  imageLoaded ? "opacity-80 group-hover:opacity-100" : "opacity-0"
                )}
                onLoad={() => setImageLoaded(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 h-7 w-7 bg-zinc-800 animate-pulse" />
              )}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm text-foreground/90 group-hover:text-foreground">
              {module.name}
            </span>
            {metaDisplay.label && (
              <span className={cn("shrink-0 text-[11px] font-semibold tabular-nums", metaDisplay.color)}>
                {metaDisplay.label}
              </span>
            )}
            <SlotBadge slotType={module.slotType as SlotType} size="sm" />
            {compatibility && (
              <CompatibilityBadge 
                isCompatible={compatibility.isCompatible}
                restriction={compatibility.restriction}
                size="sm"
              />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="right"
          className="border-border bg-popover text-popover-foreground shadow-lg"
        >
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface MarketGroupNodeProps {
  group: MarketGroup
  level?: number
  slotFilter?: SlotType | null
  shipInfo?: { id: number; name: string; groupId: number; groupName: string } | null
  compatibilityMap?: Record<number, { isCompatible: boolean; restriction?: string }>
  onModuleSelect: (module: ModuleInfo) => void
  defaultCollapsed?: boolean
  hideIncompatible?: boolean
}

export const MarketGroupNode: React.FC<MarketGroupNodeProps> = ({
  group,
  level = 0,
  slotFilter,
  shipInfo,
  compatibilityMap,
  onModuleSelect,
  defaultCollapsed = true,
  hideIncompatible = false
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true)

  const hasChildren = group.children && group.children.length > 0
  const hasModules = group.modules && group.modules.length > 0

  // Filter modules based on slot and compatibility
  const filteredModules = hasModules
    ? group.modules.filter(m => {
        const matchesSlot = !slotFilter || m.slotType === slotFilter
        if (!matchesSlot) return false
        
        if (hideIncompatible && compatibilityMap) {
          const compat = compatibilityMap[m.typeId]
          return compat?.isCompatible !== false
        }
        return true
      })
    : []

  // Filter children based on whether they have compatible modules in their tree
  const filteredChildren = hasChildren 
    ? group.children.filter(child => {
        const hasModules = hasModulesInTree(child, slotFilter, hideIncompatible ? compatibilityMap : undefined)
        return hasModules
      })
    : []

  if (filteredChildren.length === 0 && filteredModules.length === 0) {
    return null
  }

  const totalCount = countModules(group, slotFilter, hideIncompatible ? compatibilityMap : undefined)
  const displayCount = filteredChildren.reduce((acc, child) => acc + countModules(child, slotFilter, hideIncompatible ? compatibilityMap : undefined), 0) + filteredModules.length

  if (displayCount === 0 && (slotFilter || hideIncompatible)) {
    return null
  }

  return (
    <div className="select-none">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 transition-colors",
          "hover:bg-muted/40",
          level === 0 && "bg-muted/20"
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        <motion.div
          animate={{ rotate: isCollapsed ? 0 : 90 }}
          transition={{ duration: 0.15 }}
          className="flex-shrink-0"
        >
          <ChevronRight className={cn(
            "h-3 w-3 text-muted-foreground",
            (!hasChildren || level < 1) && "opacity-0"
          )} />
        </motion.div>
        
        {hasChildren ? (
          <Folder className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <Package className="h-3 w-3 shrink-0 text-muted-foreground/70" />
        )}
        
        <span className={cn(
          "truncate font-medium tracking-tight",
          level === 0 ? "text-sm text-foreground" : "text-xs text-muted-foreground"
        )}>
          {group.name}
        </span>
        
        {displayCount > 0 && (
          <span className="ml-auto pr-1 text-[11px] tabular-nums text-muted-foreground">
            {displayCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            {filteredChildren.map(child => (
              <MarketGroupNode
                key={child.id}
                group={child}
                level={level + 1}
                slotFilter={slotFilter}
                shipInfo={shipInfo}
                compatibilityMap={compatibilityMap}
                onModuleSelect={onModuleSelect}
                defaultCollapsed={level > 1}
                hideIncompatible={hideIncompatible}
              />
            ))}

            {filteredModules.length > 0 && (
              <div 
                className="space-y-0.5 py-1"
                style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const data = e.dataTransfer.getData('module')
                  if (data) {
                    try {
                      const droppedModule = JSON.parse(data)
                      onModuleSelect(droppedModule)
                    } catch (err) {
                      console.error('Failed to parse dropped module', err)
                    }
                  }
                }}
              >
                {filteredModules.map(module => (
                  <div
                    key={module.typeId}
                    draggable={shipInfo ? (compatibilityMap?.[module.typeId]?.isCompatible === true) : true}
                    onDragStart={(e) => {
                      const compat = compatibilityMap?.[module.typeId]
                      if (shipInfo && (!compat || !compat.isCompatible)) {
                        e.preventDefault()
                        return
                      }
                      e.dataTransfer.setData('module', JSON.stringify(module))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    className={cn(
                      shipInfo && compatibilityMap?.[module.typeId] && !compatibilityMap[module.typeId].isCompatible && "opacity-50 grayscale cursor-not-allowed pointer-events-none"
                    )}
                  >
                    <ModuleListItem
                      module={module}
                      compatibility={compatibilityMap?.[module.typeId]}
                      onSelect={onModuleSelect}
                    />
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function hasModulesInTree(
  group: MarketGroup, 
  slotFilter?: SlotType | null, 
  compatibilityMap?: Record<number, { isCompatible: boolean }>
): boolean {
  if (group.modules && group.modules.length > 0) {
    const hasCompatible = group.modules.some(m => {
      const matchesSlot = !slotFilter || m.slotType === slotFilter
      if (!matchesSlot) return false
      if (compatibilityMap) {
        return compatibilityMap[m.typeId]?.isCompatible !== false
      }
      return true
    })
    if (hasCompatible) return true
  }
  
  if (group.children) {
    return group.children.some(child => hasModulesInTree(child, slotFilter, compatibilityMap))
  }
  return false
}

function countModules(
  group: MarketGroup, 
  slotFilter?: SlotType | null,
  compatibilityMap?: Record<number, { isCompatible: boolean }>
): number {
  let count = 0
  
  if (group.modules && group.modules.length > 0) {
    count += group.modules.filter(m => {
      const matchesSlot = !slotFilter || m.slotType === slotFilter
      if (!matchesSlot) return false
      if (compatibilityMap) {
        return compatibilityMap[m.typeId]?.isCompatible !== false
      }
      return true
    }).length
  }
  
  if (group.children) {
    count += group.children.reduce((acc, child) => acc + countModules(child, slotFilter, compatibilityMap), 0)
  }
  
  return count
}
