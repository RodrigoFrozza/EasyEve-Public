'use client'

import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Shield, Search, Loader2, Package } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { 
  SlotFilterBar, 
  SlotFilter, 
  MarketGroupNode,
  MarketGroup,
  ModuleInfo,
  SlotType
} from './modules'
import { useTranslations } from '@/i18n/hooks'

interface ModuleBrowserPanelProps {
  onModuleSelect: (item: ModuleInfo) => void
  slots: {
    high: number
    med: number
    low: number
    rig: number
  }
  shipInfo: {
    id: number
    name: string
    groupId: number
    groupName: string
    rigSize?: number
  }
  className?: string
  defaultCollapsed?: boolean
  externalCompatibilityMap?: Record<number, CompatibilityInfo>
}

interface CompatibilityInfo {
  isCompatible: boolean
  restriction?: string
  reason?: string
}

const MOCK_MODULES: ModuleInfo[] = [
  { typeId: 438, name: '1MN Afterburner II', groupId: 46, groupName: 'Propulsion Module', slotType: 'high' },
  { typeId: 439, name: '1MN Afterburner I', groupId: 46, groupName: 'Propulsion Module', slotType: 'high' },
  { typeId: 440, name: '5MN Microwarpdrive II', groupId: 46, groupName: 'Propulsion Module', slotType: 'high' },
  { typeId: 5971, name: '5MN Microwarpdrive I', groupId: 46, groupName: 'Propulsion Module', slotType: 'high' },
  { typeId: 400, name: 'Small Shield Booster II', groupId: 40, groupName: 'Shield Booster', slotType: 'high' },
  { typeId: 1543, name: 'Small Shield Booster I', groupId: 40, groupName: 'Shield Booster', slotType: 'high' },
  { typeId: 462, name: 'Mega Pulse Laser I', groupId: 53, groupName: 'Energy Weapon', slotType: 'high' },
  { typeId: 448, name: 'Warp Scrambler II', groupId: 52, groupName: 'Warp Scrambler', slotType: 'high' },
  { typeId: 11689, name: 'Stasis Webifier II', groupId: 65, groupName: 'Stasis Web', slotType: 'high' },
  { typeId: 1547, name: 'Medium Shield Booster II', groupId: 40, groupName: 'Shield Booster', slotType: 'med' },
  { typeId: 2281, name: 'Shield Hardener II', groupId: 77, groupName: 'Shield Hardener', slotType: 'low' },
  { typeId: 1023, name: 'Damage Control II', groupId: 60, groupName: 'Damage Control', slotType: 'low' },
  { typeId: 16377, name: 'Medium Armor Repairer II', groupId: 62, groupName: 'Armor Repair Unit', slotType: 'low' },
  { typeId: 27139, name: 'Hull Repair Rig I', groupId: 153, groupName: 'Hull Repair Rig', slotType: 'rig' },
  { typeId: 27141, name: 'Armor Repair Rig I', groupId: 154, groupName: 'Armor Repair Rig', slotType: 'rig' },
  { typeId: 27145, name: 'Shield Boost Rig I', groupId: 153, groupName: 'Shield Rig', slotType: 'rig' },
]

const MOCK_MARKET_GROUPS: MarketGroup[] = [
  {
    id: 9,
    name: 'Ship Equipment',
    parentId: null,
    children: [
      {
        id: 10,
        name: 'Turrets & Launchers',
        parentId: 9,
        children: [
          {
            id: 88,
            name: 'Energy Turrets',
            parentId: 10,
            children: [],
            modules: MOCK_MODULES.filter(m => m.groupName === 'Energy Weapon')
          },
          {
            id: 52,
            name: 'Propulsion',
            parentId: 10,
            children: [],
            modules: MOCK_MODULES.filter(m => m.groupName === 'Propulsion Module')
          }
        ],
        modules: []
      },
      {
        id: 14,
        name: 'Hull & Armor',
        parentId: 9,
        children: [],
        modules: MOCK_MODULES.filter(m => 
          m.groupName === 'Armor Repair Unit' || 
          m.groupName === 'Damage Control'
        )
      },
      {
        id: 554,
        name: 'Shield',
        parentId: 9,
        children: [],
        modules: MOCK_MODULES.filter(m => 
          m.groupName === 'Shield Booster' || 
          m.groupName === 'Shield Hardener'
        )
      },
      {
        id: 657,
        name: 'Electronic Warfare',
        parentId: 9,
        children: [],
        modules: MOCK_MODULES.filter(m => 
          m.groupName === 'Warp Scrambler' || 
          m.groupName === 'Stasis Web'
        )
      },
      {
        id: 938,
        name: 'Rig Slots',
        parentId: 9,
        children: [],
        modules: MOCK_MODULES.filter(m => m.groupName.includes('Rig'))
      }
    ],
    modules: []
  }
]

export const ModuleBrowserPanel: React.FC<ModuleBrowserPanelProps> = ({
  onModuleSelect,
  slots,
  shipInfo,
  className,
  defaultCollapsed = true,
  externalCompatibilityMap
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [slotFilter, setSlotFilter] = useState<SlotFilter>(null)
  const [tierFilter, setTierFilter] = useState<string | null>(null)
  const [marketGroups, setMarketGroups] = useState<MarketGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [usingMockData, setUsingMockData] = useState(false)
  const [internalCompatibilityMap, setInternalCompatibilityMap] = useState<Record<number, CompatibilityInfo>>({})
  const [hideIncompatible, setHideIncompatible] = useState(true)
  const { t } = useTranslations()

  const compatibilityMap = externalCompatibilityMap || internalCompatibilityMap

  const TIER_OPTIONS = [
    { value: null, label: 'All', color: 'text-zinc-400' },
    { value: 'Tech I', label: 'T1', color: 'text-zinc-500' },
    { value: 'Tech II', label: 'T2', color: 'text-yellow-400' },
    { value: 'Tech III', label: 'T3', color: 'text-blue-400' },
    { value: 'Faction', label: 'Faction', color: 'text-green-400' },
    { value: 'Storyline', label: 'Story', color: 'text-emerald-300' },
    { value: 'Deadspace', label: 'Dead', color: 'text-blue-500' },
    { value: 'Officer', label: 'Officer', color: 'text-purple-400' },
  ]

  useEffect(() => {
    const fetchMarketGroups = async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/modules/market-groups')
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.details || 'API failed')
        }
        const data = await res.json()
        
        // The API returns the array directly, or an object with groups property
        const groups = Array.isArray(data) ? data : (data.groups || [])
        
        if (groups.length > 0) {
          setMarketGroups(groups)
          setUsingMockData(false)
        } else {
          throw new Error('No data')
        }
      } catch (err) {
        console.error('Market groups fetch failed:', err)
        console.log('Using mock data for development')
        setMarketGroups(MOCK_MARKET_GROUPS)
        setUsingMockData(true)
      } finally {
        setLoading(false)
      }
    }
    fetchMarketGroups()
  }, [])

  // Listen for quick-add module hotkey from parent
  useEffect(() => {
    const handleQuickAdd = (e: Event) => {
      const customEvent = e as CustomEvent<{ slotType: 'high' | 'med' | 'low' | 'rig' }>
      setSlotFilter(customEvent.detail.slotType)
    }
    
    window.addEventListener('quickAddModule', handleQuickAdd)
    return () => window.removeEventListener('quickAddModule', handleQuickAdd)
  }, [])

  useEffect(() => {
    const fetchCompatibility = async () => {
      if (!shipInfo?.id || externalCompatibilityMap) {
        if (!externalCompatibilityMap) setInternalCompatibilityMap({})
        return
      }

      try {
        const params = new URLSearchParams({
          shipGroupId: (shipInfo.groupId || 0).toString(),
          shipTypeId: shipInfo.id.toString(),
        })
        if (shipInfo.rigSize) {
          params.append('rigSize', shipInfo.rigSize.toString())
        }

        const res = await fetch(`/api/modules/compatibility?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()
        
        const map: Record<number, CompatibilityInfo> = {}
        for (const [typeId, compat] of Object.entries(data.compatibility)) {
          const c = compat as any
          map[parseInt(typeId)] = {
            isCompatible: c.isCompatible !== false,
            restriction: c.restriction || c.reason,
            reason: c.reason || c.restriction,
          }
        }
        setInternalCompatibilityMap(map)
      } catch (err) {
        console.log('Compatibility check failed, using mock compatibility')
        setInternalCompatibilityMap({})
      }
    }
    fetchCompatibility()
  }, [shipInfo?.id, shipInfo?.groupId, shipInfo?.rigSize, externalCompatibilityMap])

  const handleModuleSelect = useCallback((module: ModuleInfo) => {
    const compat = compatibilityMap[module.typeId]
    
    if (compat && !compat.isCompatible) {
      toast.error(
        `Cannot fit ${module.name}`,
        { description: compat.restriction ? `Restricted to: ${compat.restriction}` : 'Incompatible with current ship' }
      )
      return
    }

    onModuleSelect({
      typeId: module.typeId,
      name: module.name,
      groupId: module.groupId,
      groupName: module.groupName,
      slotType: module.slotType as SlotType
    })
  }, [onModuleSelect, compatibilityMap])

  const filteredGroups = useMemo(() => {
    const filterByTier = (modules: any[]): any[] => {
      if (!tierFilter) return modules
      return modules.filter(m => {
        const meta = m.metaGroupName
        if (tierFilter === 'Officer') return meta?.includes('Officer')
        if (tierFilter === 'Deadspace') return meta?.includes('Deadspace')
        if (tierFilter === 'Faction') return meta?.includes('Faction')
        if (tierFilter === 'Storyline') return meta?.includes('Storyline')
        if (tierFilter === 'Tech II') return meta?.includes('Tech II') || m.metaLevel === 2
        if (tierFilter === 'Tech III') return meta?.includes('Tech III') || m.metaLevel === 3
        if (tierFilter === 'Tech I') return meta === 'Tech I' || meta === undefined || meta === null || (m.metaLevel === 1 || m.metaLevel === 0)
        return true
      })
    }

    const filterByCompatibility = (modules: any[]): any[] => {
      if (!hideIncompatible || !shipInfo?.groupId) return modules
      return modules.filter(m => {
        const compat = compatibilityMap[m.typeId]
        return !compat || compat.isCompatible
      })
    }

    const filterTree = (groups: MarketGroup[]): MarketGroup[] => {
      return groups.reduce((acc: MarketGroup[], group) => {
        const filteredChildren = filterTree(group.children || [])
        let filteredModules = filterByTier(group.modules || [])
        filteredModules = filterByCompatibility(filteredModules)
        
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          const searchFiltered = filteredModules.filter(
            m => m.name.toLowerCase().includes(query) || 
                 m.groupName.toLowerCase().includes(query)
          )
          const searchFilteredChildren = searchFiltered.length > 0 ? filteredModules : []
          if (filteredChildren.length > 0 || searchFilteredChildren.length > 0) {
            acc.push({
              ...group,
              children: filteredChildren,
              modules: searchFiltered
            })
          }
        } else {
          if (filteredChildren.length > 0 || filteredModules.length > 0) {
            acc.push({
              ...group,
              children: filteredChildren,
              modules: filteredModules
            })
          }
        }
        
        return acc
      }, [])
    }
    
    return filterTree(marketGroups)
  }, [marketGroups, searchQuery, tierFilter, hideIncompatible, compatibilityMap, shipInfo?.groupId])

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card/30", className)}>
      {/* Header */}
      <div className="space-y-3 border-b border-border/80 px-3 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/40">
              <Package className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold leading-tight text-foreground">
                {t('fits.moduleBrowser.title')}
              </p>
              {usingMockData && (
                <p className="text-[11px] font-medium text-amber-600/80">DEV data</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              title={hideIncompatible ? t('fits.moduleBrowser.hideIncompatibleOn') : t('fits.moduleBrowser.hideIncompatibleOff')}
              onClick={() => setHideIncompatible(!hideIncompatible)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors",
                hideIncompatible
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {hideIncompatible ? t('fits.moduleBrowser.hideIncompatibleOn') : t('fits.moduleBrowser.hideIncompatibleOff')}
            </button>
            {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('fits.moduleBrowser.searchPlaceholder')}
            className="h-10 border-border bg-background/60 pl-9 text-sm placeholder:text-muted-foreground"
          />
        </div>

        {shipInfo?.id && (slots.high > 0 || slots.med > 0 || slots.low > 0 || slots.rig > 0) ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-medium text-muted-foreground">{shipInfo.groupName}</span>
            <span className="text-border">·</span>
            <div className="flex flex-wrap gap-1">
              {slots.high > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-red-500/50 bg-red-500/25 px-2 py-0.5 font-mono text-[11px] tabular-nums text-red-100">
                  <span className="font-semibold">{slots.high}</span>
                  <span className="text-red-200/90">Hi</span>
                </span>
              )}
              {slots.med > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/50 bg-blue-500/25 px-2 py-0.5 font-mono text-[11px] tabular-nums text-blue-100">
                  <span className="font-semibold">{slots.med}</span>
                  <span className="text-blue-200/90">Med</span>
                </span>
              )}
              {slots.low > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/55 bg-amber-500/25 px-2 py-0.5 font-mono text-[11px] tabular-nums text-amber-100">
                  <span className="font-semibold">{slots.low}</span>
                  <span className="text-amber-200/90">Low</span>
                </span>
              )}
              {slots.rig > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md border border-teal-500/55 bg-teal-500/25 px-2 py-0.5 font-mono text-[11px] tabular-nums text-teal-100">
                  <span className="font-semibold">{slots.rig}</span>
                  <span className="text-teal-200/90">Rig</span>
                </span>
              )}
            </div>
          </div>
        ) : null}

        <div className="-mx-3 sticky top-0 z-10 border-y border-border/70 bg-card/90 px-3 py-2 backdrop-blur-sm">
          <SlotFilterBar value={slotFilter} onChange={setSlotFilter} className="flex-nowrap overflow-x-auto pb-1" />
          <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
            {TIER_OPTIONS.map((tier) => (
              <button
                key={tier.value ?? 'all'}
                type="button"
                onClick={() => setTierFilter(tier.value)}
                className={cn(
                  "cursor-pointer whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  tierFilter === tier.value
                    ? "border-primary/60 bg-primary/20 text-primary"
                    : "border-border/40 bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <span className={cn(tierFilter !== tier.value && tier.color)}>{tier.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 className="mx-auto mb-2 h-8 w-8 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {t('fits.moduleBrowser.loadingModules')}
            </span>
          </div>
        ) : !shipInfo?.id ? (
          <div className="flex h-[280px] flex-col items-center justify-center gap-4 px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted/30">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{t('fits.moduleBrowser.chassisLockTitle')}</p>
              <p className="mx-auto max-w-[220px] text-xs leading-snug text-muted-foreground">
                {t('fits.moduleBrowser.chassisLockHint')}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-xs font-medium"
              onClick={() => window.dispatchEvent(new CustomEvent('openShipSelector'))}
            >
              {t('fits.moduleBrowser.openShipSelector')}
            </Button>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="p-6 text-center">
            <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
            <span className="text-xs text-muted-foreground">
              {t('fits.moduleBrowser.noModules')}
            </span>
          </div>
        ) : (
          filteredGroups.map(group => (
            <MarketGroupNode
              key={group.id}
              group={group}
              slotFilter={slotFilter}
              shipInfo={shipInfo}
              compatibilityMap={compatibilityMap}
              onModuleSelect={handleModuleSelect}
              hideIncompatible={hideIncompatible}
              defaultCollapsed={defaultCollapsed}
            />
          ))
        )}
      </div>
    </div>
  )
}
