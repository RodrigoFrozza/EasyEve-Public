'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Ship as ShipIcon,
  Check,
  ChevronRight,
  Box,
  LayoutGrid,
  Activity,
  Search,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useTranslations } from '@/i18n/hooks'
import {
  SHIP_FACTION_OPTIONS,
  getShipFactionLabel,
  normalizeShipFactionId,
  type ShipFactionId,
} from '@/lib/ships/ship-taxonomy'

interface Ship {
  id: number
  name: string
  groupName: string
  groupId?: number | null
  faction?: string
  iconId?: number
  factionId?: ShipFactionId
}

interface ShipGroupOption {
  id: number
  label: string
  count: number
}

interface ShipFactionBucket {
  id: ShipFactionId
  label: string
  count: number
  ships: Ship[]
}

interface ShipGroupTreeNode {
  id: number
  label: string
  count: number
  children: ShipGroupTreeNode[]
  factions: ShipFactionBucket[]
}

interface ShipSelectorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (ship: Ship) => void
}

const FACTION_DOT_CLASS: Partial<Record<ShipFactionId, string>> = {
  amarr: 'bg-amber-400/90',
  caldari: 'bg-sky-400/90',
  gallente: 'bg-emerald-400/90',
  minmatar: 'bg-orange-400/90',
  triglavian: 'bg-red-400/90',
  concord: 'bg-blue-400/90',
  edencom: 'bg-cyan-400/90',
  sisters_of_eve: 'bg-violet-400/90',
}

const STORAGE_KEYS = {
  expandedGroups: 'shipSelector:expandedGroups',
  expandedFactions: 'shipSelector:expandedFactions',
} as const

export const ShipSelector: React.FC<ShipSelectorProps> = ({ open, onOpenChange, onSelect }) => {
  const { t } = useTranslations()
  const [search, setSearch] = useState('')
  const [allShips, setAllShips] = useState<Ship[]>([])
  const [marketTree, setMarketTree] = useState<ShipGroupTreeNode[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFaction, setActiveFaction] = useState<ShipFactionId>('all')
  const [imgErrors, setImgErrors] = useState<Record<number, boolean>>({})
  const [activeGroupId, setActiveGroupId] = useState<number | 'all'>('all')
  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({})
  const [expandedFactions, setExpandedFactions] = useState<Record<string, boolean>>({})
  const [activeSuggestion, setActiveSuggestion] = useState(0)

  const handleImgError = (shipId: number) => {
    setImgErrors(prev => ({ ...prev, [shipId]: true }))
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedGroups = window.localStorage.getItem(STORAGE_KEYS.expandedGroups)
      if (savedGroups) {
        const parsed = JSON.parse(savedGroups) as Record<string, boolean>
        const normalized: Record<number, boolean> = {}
        for (const [key, value] of Object.entries(parsed)) {
          const num = Number(key)
          if (Number.isFinite(num) && typeof value === 'boolean') normalized[num] = value
        }
        if (Object.keys(normalized).length > 0) setExpandedGroups(normalized)
      }

      const savedFactions = window.localStorage.getItem(STORAGE_KEYS.expandedFactions)
      if (savedFactions) {
        const parsed = JSON.parse(savedFactions) as Record<string, boolean>
        if (typeof parsed === 'object' && parsed) setExpandedFactions(parsed)
      }
    } catch {
      // no-op: localStorage is best-effort
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const fetchShips = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams()
        if (search) params.append('search', search)
        params.append('limit', '4000')
        
        const res = await fetch(`/api/ships?${params.toString()}`)
        if (!res.ok) throw new Error()
        const data = await res.json()
        setAllShips(
          (data.ships || []).map((ship: Ship) => ({
            ...ship,
            factionId: ship.factionId ?? normalizeShipFactionId(ship.faction),
          }))
        )
      } catch (err) {
        toast.error('Failed to search ships')
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchShips, 300)
    return () => clearTimeout(timer)
  }, [search, open])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.expandedGroups, JSON.stringify(expandedGroups))
  }, [expandedGroups])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(STORAGE_KEYS.expandedFactions, JSON.stringify(expandedFactions))
  }, [expandedFactions])

  useEffect(() => {
    if (!open) return
    let aborted = false

    const fetchTree = async () => {
      try {
        const res = await fetch('/api/ships/tree')
        if (!res.ok) throw new Error('tree_fetch_failed')
        const data = await res.json()
        if (aborted) return
        const groups = Array.isArray(data.groups) ? data.groups : []
        setMarketTree(groups)
      } catch {
        if (!aborted) {
          toast.error('Failed to load ship hierarchy')
        }
      }
    }

    fetchTree()
    return () => {
      aborted = true
    }
  }, [open])

  useEffect(() => {
    if (!open || marketTree.length === 0) return
    if (Object.keys(expandedGroups).length > 0) return

    const initial: Record<number, boolean> = {}
    for (const root of marketTree) {
      initial[root.id] = true
      for (const child of root.children) {
        initial[child.id] = true
      }
    }
    setExpandedGroups(initial)
  }, [open, marketTree, expandedGroups])

  const groupTree = marketTree

  const groupOptions = useMemo<ShipGroupOption[]>(() => {
    const options: ShipGroupOption[] = []
    const walk = (nodes: ShipGroupTreeNode[]) => {
      for (const node of nodes) {
        options.push({ id: node.id, label: node.label, count: node.count })
        if (node.children.length > 0) walk(node.children)
      }
    }
    walk(groupTree)
    return options
  }, [groupTree])

  const groupShipIdsMap = useMemo(() => {
    const byNodeId = new Map<number, Set<number>>()
    const walk = (node: ShipGroupTreeNode): Set<number> => {
      const set = new Set<number>()
      for (const faction of node.factions) {
        for (const ship of faction.ships) set.add(ship.id)
      }
      for (const child of node.children) {
        const childSet = walk(child)
        for (const id of childSet) set.add(id)
      }
      byNodeId.set(node.id, set)
      return set
    }
    for (const root of groupTree) walk(root)
    return byNodeId
  }, [groupTree])

  const trimmedSearch = search.trim().toLowerCase()
  const autocompleteSuggestions = useMemo(() => {
    if (trimmedSearch.length < 2) return []

    const shipSuggestions = allShips
      .filter((ship) => ship.name.toLowerCase().includes(trimmedSearch))
      .slice(0, 4)
      .map((ship) => ({ id: `ship-${ship.id}`, type: 'ship' as const, label: ship.name, value: ship.name }))

    const groupSuggestions = groupOptions
      .filter((shipGroup) => shipGroup.label.toLowerCase().includes(trimmedSearch))
      .slice(0, 3)
      .map((shipGroup) => ({ id: `group-${shipGroup.id}`, type: 'group' as const, label: `${shipGroup.label} (#${shipGroup.id})`, value: shipGroup.id }))

    const factionSuggestions = SHIP_FACTION_OPTIONS
      .filter((faction) => faction.id !== 'all' && faction.label.toLowerCase().includes(trimmedSearch))
      .slice(0, 3)
      .map((faction) => ({ id: `faction-${faction.id}`, type: 'faction' as const, label: faction.label, value: faction.id }))

    return [...shipSuggestions, ...groupSuggestions, ...factionSuggestions].slice(0, 8)
  }, [allShips, groupOptions, trimmedSearch])

  useEffect(() => {
    setActiveSuggestion(0)
  }, [search, autocompleteSuggestions.length])

  const applySuggestion = (index: number) => {
    const suggestion = autocompleteSuggestions[index]
    if (!suggestion) return

    if (suggestion.type === 'ship') {
      setSearch(suggestion.value)
      return
    }

    if (suggestion.type === 'group') {
      setActiveGroupId(suggestion.value as number)
      return
    }

    setActiveFaction(suggestion.value as ShipFactionId)
  }

  const activeGroupLabel = useMemo(() => {
    if (activeGroupId === 'all') return null
    const found = groupOptions.find((group) => group.id === activeGroupId)
    return found ? `${found.label} (#${found.id})` : `Group #${activeGroupId}`
  }, [activeGroupId, groupOptions])

  const hasActiveFilters = activeGroupId !== 'all' || activeFaction !== 'all' || search.trim().length > 0

  const filteredShips = useMemo(() => {
    let result = allShips
    if (activeGroupId !== 'all') {
      const groupShipIds = groupShipIdsMap.get(activeGroupId)
      if (groupShipIds) {
        result = result.filter((ship) => groupShipIds.has(ship.id))
      } else {
        result = []
      }
    }
    if (activeFaction !== 'all') {
      result = result.filter((ship) => (ship.factionId ?? normalizeShipFactionId(ship.faction)) === activeFaction)
    }
    return result
  }, [allShips, activeGroupId, activeFaction, groupShipIdsMap])

  const visibleShipIds = useMemo(() => {
    return new Set(filteredShips.map((ship) => ship.id))
  }, [filteredShips])

  const visibleCountByGroupId = useMemo(() => {
    const counts = new Map<number, number>()
    const walk = (node: ShipGroupTreeNode): number => {
      let ownVisible = 0
      for (const faction of node.factions) {
        for (const ship of faction.ships) {
          if (visibleShipIds.has(ship.id)) ownVisible += 1
        }
      }
      const childrenVisible = node.children.reduce((acc, child) => acc + walk(child), 0)
      const totalVisible = ownVisible + childrenVisible
      counts.set(node.id, totalVisible)
      return totalVisible
    }
    for (const root of groupTree) walk(root)
    return counts
  }, [groupTree, visibleShipIds])

  const toggleGroupExpanded = (groupId: number) => {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const toggleFactionExpanded = (groupId: number, factionId: ShipFactionId) => {
    const key = `${groupId}:${factionId}`
    setExpandedFactions((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const selectShip = (ship: Ship) => {
    onSelect(ship)
    onOpenChange(false)
  }

  // Clean file-explorer tree: indentation + a subtle guide line come from the
  // nested wrappers, not per-node boxes; internal ids are never shown.
  const renderTreeRow = ({
    active,
    isOpen,
    hasChildren,
    onToggle,
    onSelect,
    dotClass,
    label,
    count,
    dense,
  }: {
    active: boolean
    isOpen: boolean
    hasChildren: boolean
    onToggle?: () => void
    onSelect: () => void
    dotClass?: string
    label: string
    count?: number
    dense?: boolean
  }) => (
    <div
      className={cn(
        'group/row relative flex items-stretch rounded-md transition-colors',
        active ? 'bg-primary/10' : 'hover:bg-white/[0.04]'
      )}
    >
      {active && <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-primary" aria-hidden />}
      <button
        type="button"
        aria-label={`Toggle ${label}`}
        onClick={onToggle}
        disabled={!hasChildren}
        className="flex w-6 shrink-0 items-center justify-center text-zinc-600 transition-colors hover:text-zinc-300 disabled:opacity-0"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-90')} />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center justify-between gap-2 py-1.5 pr-2 text-left transition-colors',
          dense ? 'text-[12px]' : 'text-[13px]',
          active ? 'font-medium text-primary' : 'text-zinc-300 hover:text-white'
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          {dotClass && <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />}
          <span className="truncate">{label}</span>
        </span>
        {count != null && (
          <span className={cn('shrink-0 text-[11px] tabular-nums', active ? 'text-primary/70' : 'text-zinc-600')}>
            {count}
          </span>
        )}
      </button>
    </div>
  )

  const renderGroupNode = (group: ShipGroupTreeNode, depth: number = 0): React.ReactNode => {
    const groupActive = activeGroupId === group.id && activeFaction === 'all'
    const visibleCount = visibleCountByGroupId.get(group.id) ?? 0
    if (visibleCount <= 0) return null
    const isOpen = !!expandedGroups[group.id]
    const hasChildren = group.children.length > 0 || group.factions.length > 0

    return (
      <div key={group.id}>
        {renderTreeRow({
          active: groupActive,
          isOpen,
          hasChildren,
          onToggle: () => toggleGroupExpanded(group.id),
          onSelect: () => {
            setActiveGroupId(group.id)
            setActiveFaction('all')
          },
          label: group.label,
          count: visibleCount,
        })}

        {isOpen && hasChildren && (
          <div className="ml-3 border-l border-white/[0.06] pl-1">
            {group.children.map((child) => renderGroupNode(child, depth + 1))}
            {group.factions.map((faction) => {
              const visibleShips = [...faction.ships]
                .filter((ship) => visibleShipIds.has(ship.id))
                .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
              if (visibleShips.length === 0) return null
              const factionKey = `${group.id}:${faction.id}`
              const factionActive = activeGroupId === group.id && activeFaction === faction.id
              const dotClass = FACTION_DOT_CLASS[faction.id] ?? 'bg-zinc-500/80'
              const factionExpanded = !!expandedFactions[factionKey]
              return (
                <div key={factionKey}>
                  {renderTreeRow({
                    active: factionActive,
                    isOpen: factionExpanded,
                    hasChildren: true,
                    onToggle: () => toggleFactionExpanded(group.id, faction.id),
                    onSelect: () => {
                      setActiveGroupId(group.id)
                      setActiveFaction(faction.id)
                    },
                    dotClass,
                    label: faction.label,
                    count: visibleShips.length,
                    dense: true,
                  })}

                  {factionExpanded && (
                    <div className="ml-3 border-l border-white/[0.06] pl-1">
                      {visibleShips.map((ship) => (
                        <button
                          key={ship.id}
                          type="button"
                          onClick={() =>
                            selectShip({
                              ...ship,
                              factionId: ship.factionId ?? normalizeShipFactionId(ship.faction),
                            })
                          }
                          className="flex w-full items-center gap-2 rounded-md py-1.5 pl-2 pr-2 text-left text-[12px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-50"
                        >
                          <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full opacity-60', dotClass)} aria-hidden />
                          <span className="truncate">{ship.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[84vh] max-h-[84vh] w-[min(1120px,94vw)] max-w-[1120px] flex-col overflow-hidden border-white/5 bg-zinc-950 p-0 shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        <Command
          shouldFilter={false}
          className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-none bg-transparent text-zinc-100 [&_[cmdk-input-wrapper]]:rounded-lg [&_[cmdk-input-wrapper]]:border [&_[cmdk-input-wrapper]]:border-white/10 [&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:bg-white/5 [&_[cmdk-input-wrapper]]:px-2"
        >
          {/* Header - Compact */}
          <DialogHeader className="glassmorphism relative border-b border-white/5 bg-zinc-900/20 px-5 py-4">
            <div className="relative z-10 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between xl:gap-6">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                  <ShipIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight text-white">
                    {t('fits.shipExplorer.title')}
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    {t('fits.shipExplorer.subtitle')}
                  </DialogDescription>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="relative w-full min-w-0 flex-1 max-w-lg group">
                  <Search className="pointer-events-none absolute left-3 top-3.5 z-20 h-4 w-4 text-zinc-500" />
                  <CommandInput
                    value={search}
                    onValueChange={setSearch}
                    onKeyDown={(event) => {
                      if (autocompleteSuggestions.length === 0) return
                      if (event.key === 'ArrowDown') {
                        event.preventDefault()
                        setActiveSuggestion((prev) => (prev + 1) % autocompleteSuggestions.length)
                      }
                      if (event.key === 'ArrowUp') {
                        event.preventDefault()
                        setActiveSuggestion((prev) => (prev - 1 + autocompleteSuggestions.length) % autocompleteSuggestions.length)
                      }
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        applySuggestion(activeSuggestion)
                      }
                    }}
                    placeholder={t('fits.shipExplorer.searchAdvancedPlaceholder')}
                    className="h-10 border-0 pl-8 text-sm font-normal tracking-normal focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground"
                  />
                  {autocompleteSuggestions.length > 0 && (
                    <div className="absolute inset-x-0 top-[calc(100%+8px)] z-30 rounded-xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl backdrop-blur-lg">
                      <div className="mb-1 px-2 text-[10px] uppercase tracking-wide text-zinc-500">{t('fits.shipExplorer.autocompleteLabel')}</div>
                      <div className="space-y-1">
                        {autocompleteSuggestions.map((suggestion, index) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            onClick={() => applySuggestion(index)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition-colors',
                              activeSuggestion === index
                                ? 'bg-primary/15 text-primary'
                                : 'text-zinc-300 hover:bg-white/5'
                            )}
                          >
                            <span>{suggestion.label}</span>
                            <span className="rounded border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-zinc-500">
                              {suggestion.type}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setActiveGroupId('all')
                    setActiveFaction('all')
                    setSearch('')
                  }}
                  className="h-7 shrink-0 rounded-full border border-white/10 px-3 text-[11px] text-zinc-300 hover:text-white"
                >
                  {t('fits.shipExplorer.clearAll')}
                </Button>
              )}
            </div>
          </DialogHeader>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          
          {/* Sidebar filters */}
          <aside className="flex w-[21.5rem] shrink-0 flex-col border-r border-white/5 bg-black/60 backdrop-blur-xl">
            <div className="border-b border-white/5 bg-white/5 p-3.5">
              <button
                onClick={() => {
                  setActiveGroupId('all')
                  setActiveFaction('all')
                  setSearch('')
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border p-2.5 text-xs font-semibold tracking-tight transition-all",
                  activeGroupId === 'all' && activeFaction === 'all'
                    ? "border-primary/30 bg-primary/15 text-primary"
                    : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                {t('fits.shipExplorer.showAllHulls')}
              </button>
            </div>

            <ScrollArea className="flex-1">
              <div className="space-y-5 p-3.5">
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-zinc-500">
                    <span>{t('fits.shipExplorer.marketTreeLabel')}</span>
                    <span className="font-mono text-[10px] text-zinc-600">{filteredShips.length}</span>
                  </div>
                  <div className="space-y-1">
                    {groupTree.map((group) => renderGroupNode(group))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </aside>

          {/* Main area: hull grid only */}
          <section className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-950 px-2 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2 px-3.5">
              <span className="text-xs font-medium text-zinc-400">
                {t('fits.shipExplorer.resultsCount', { count: filteredShips.length })}
              </span>
              {hasActiveFilters && <span className="h-3 w-px bg-white/10" aria-hidden />}
              {activeGroupId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveGroupId('all')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-1 pl-2.5 pr-1.5 text-[11px] text-primary transition-colors hover:bg-primary/15"
                >
                  {activeGroupLabel ?? t('fits.shipExplorer.allClassesLabel')}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              )}
              {activeFaction !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFaction('all')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10"
                >
                  <span className={cn('h-2 w-2 rounded-full', FACTION_DOT_CLASS[activeFaction] ?? 'bg-zinc-500/80')} aria-hidden />
                  {getShipFactionLabel(activeFaction)}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              )}
              {search.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 py-1 pl-2.5 pr-1.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10"
                >
                  {`"${search}"`}
                  <X className="h-3 w-3 opacity-70" />
                </button>
              )}
            </div>
            <CommandList className="h-full max-h-none flex-1 overflow-y-auto overflow-x-hidden rounded-none border-0 bg-transparent p-0">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="py-32 flex flex-col items-center justify-center space-y-4">
                    <Activity className="w-10 h-10 text-primary animate-spin opacity-40" />
                    <p className="text-sm text-muted-foreground">{t('fits.shipExplorer.loadingShips')}</p>
                  </div>
                ) : filteredShips.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {filteredShips.map((ship, idx) => (
                      <motion.div
                        layout
                        key={ship.id}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.18, delay: Math.min(idx * 0.012, 0.25) }}
                        className="min-w-0"
                      >
                        <CommandItem
                          value={`${ship.id}-${ship.name}`}
                          onSelect={() => selectShip(ship)}
                          className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/50 text-left transition-all hover:border-white/20 data-[selected=true]:border-primary/60 data-[selected=true]:bg-primary/10 aria-selected:border-primary/60 aria-selected:bg-primary/10"
                        >
                          <div className="relative flex aspect-[4/3] w-full items-center justify-center bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.05),transparent_70%)]">
                            {ship.faction && (
                              <div
                                className={cn(
                                  'absolute left-2.5 top-2.5 h-2 w-2 rounded-full',
                                  FACTION_DOT_CLASS[ship.factionId ?? normalizeShipFactionId(ship.faction)] ?? 'bg-zinc-500/70'
                                )}
                                title={getShipFactionLabel(ship.factionId ?? normalizeShipFactionId(ship.faction))}
                              />
                            )}
                            {imgErrors[ship.id] || ship.id <= 1 ? (
                              <ShipIcon className="h-1/2 w-1/2 text-zinc-700 opacity-60" />
                            ) : (
                              <Image
                                src={`https://images.evetech.net/types/${ship.id}/render?size=256`}
                                alt={ship.name}
                                width={256}
                                height={256}
                                className="h-full w-full object-contain p-1 drop-shadow-[0_6px_12px_rgba(0,0,0,0.5)] transition-transform duration-300 group-hover:scale-[1.06]"
                                onError={() => handleImgError(ship.id)}
                              />
                            )}
                            <div className="absolute right-2 top-2 flex h-5 w-5 scale-90 items-center justify-center rounded-md bg-primary text-primary-foreground opacity-0 shadow-lg transition-all group-hover:scale-100 group-hover:opacity-100 group-data-[selected=true]:scale-100 group-data-[selected=true]:opacity-100">
                              <Check className="h-3 w-3" />
                            </div>
                          </div>
                          <div className="border-t border-white/10 bg-zinc-950/80 px-2.5 py-2 transition-colors group-hover:bg-white/[0.03]">
                            <div
                              className="line-clamp-2 min-h-[2.1em] text-[12.5px] font-semibold leading-tight text-foreground"
                              title={ship.name}
                            >
                              {ship.name}
                            </div>
                            <div
                              className="mt-0.5 line-clamp-1 text-[10.5px] leading-tight text-zinc-500"
                              title={ship.groupName}
                            >
                              {ship.groupName}
                            </div>
                          </div>
                        </CommandItem>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <CommandEmpty className="py-40">
                    <div className="flex flex-col items-center space-y-6 text-center">
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/5 bg-white/5 opacity-20">
                        <Box className="h-8 w-8" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">{t('fits.shipExplorer.emptyTitle')}</p>
                        <p className="text-xs text-muted-foreground">{t('fits.shipExplorer.emptyHint')}</p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setActiveFaction('all')
                          setActiveGroupId('all')
                          setSearch('')
                        }}
                        className="text-xs font-medium text-primary hover:text-primary/90"
                      >
                        {t('fits.shipExplorer.resetFilters')}
                      </Button>
                    </div>
                  </CommandEmpty>
                )}
              </AnimatePresence>
            </CommandList>
          </section>
        </div>
        </Command>
      </DialogContent>
      
      <style jsx global>{`
        .glassmorphism {
          background: rgba(10, 10, 10, 0.4);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
      `}</style>
    </Dialog>
  )
}
