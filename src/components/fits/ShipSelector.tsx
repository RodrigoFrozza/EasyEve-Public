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
  Sparkles,
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

  const quickKeywordFilters = [
    { id: 'kw-amarr', label: 'Amarr', factionId: 'amarr' as ShipFactionId },
    { id: 'kw-caldari', label: 'Caldari', factionId: 'caldari' as ShipFactionId },
    { id: 'kw-serpentis', label: 'Serpentis', factionId: 'serpentis' as ShipFactionId },
    { id: 'kw-blood-raider', label: 'Blood Raider', factionId: 'blood_raider' as ShipFactionId },
  ]

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

  const renderGroupNode = (group: ShipGroupTreeNode, depth: number = 0): React.ReactNode => {
    const groupActive = activeGroupId === group.id && activeFaction === 'all'
    const leftPad = 8 + depth * 16
    const visibleCount = visibleCountByGroupId.get(group.id) ?? 0
    if (visibleCount <= 0) return null

    return (
      <div key={group.id} className="space-y-1.5">
        <div
          className={cn(
            'rounded-xl border p-1.5',
            depth === 0 ? 'border-white/10 bg-black/35' : 'border-white/5 bg-black/20'
          )}
          style={{ marginLeft: depth > 0 ? 10 : 0 }}
        >
          <div
            className={cn(
              'flex min-h-10 w-full items-center gap-1 rounded-lg px-1.5',
              groupActive ? 'bg-blue-500/12 ring-1 ring-inset ring-blue-500/20' : 'hover:bg-white/5'
            )}
            style={{ paddingLeft: `${leftPad}px` }}
          >
            <button
              type="button"
              aria-label={`Toggle group ${group.label}`}
              onClick={() => toggleGroupExpanded(group.id)}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <ChevronRight
                className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', expandedGroups[group.id] ? 'rotate-90' : '')}
              />
            </button>
            <button
              type="button"
              aria-label={`Filter by group ${group.label}`}
              onClick={() => {
                setActiveGroupId(group.id)
                setActiveFaction('all')
              }}
              className={cn(
                'flex min-h-8 min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50',
                groupActive ? 'text-blue-300' : 'text-zinc-300 hover:text-zinc-100'
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-500/80" />
                <span className="truncate font-medium">{group.label}</span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-500">#{group.id}</span>
              </span>
              <span className="ml-2 shrink-0 font-mono text-[10px] text-zinc-500">{visibleCount}</span>
            </button>
          </div>

          {expandedGroups[group.id] && (
            <div className="mt-1.5 space-y-1.5 border-l border-white/10 pl-2.5">
              {group.children.map((child) => renderGroupNode(child, depth + 1))}
              {group.factions.map((faction) => {
                const visibleShips = [...faction.ships]
                  .filter((ship) => visibleShipIds.has(ship.id))
                  .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
                if (visibleShips.length === 0) return null
                const factionKey = `${group.id}:${faction.id}`
                const factionActive = activeGroupId === group.id && activeFaction === faction.id
                const dotClass = FACTION_DOT_CLASS[faction.id] ?? 'bg-zinc-500/80'
                const factionExpanded = expandedFactions[factionKey]
                return (
                  <div key={factionKey}>
                    <div
                      className={cn(
                        'flex min-h-9 items-center gap-1 rounded-md px-1',
                        factionActive ? 'bg-emerald-500/12 ring-1 ring-inset ring-emerald-500/20' : 'hover:bg-white/5'
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Toggle faction ${faction.label}`}
                        onClick={() => toggleFactionExpanded(group.id, faction.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/10 hover:text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40"
                      >
                        <ChevronRight
                          className={cn('h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform', factionExpanded ? 'rotate-90' : '')}
                        />
                      </button>
                      <button
                        type="button"
                        aria-label={`Filter by faction ${faction.label}`}
                        onClick={() => {
                          setActiveGroupId(group.id)
                          setActiveFaction(faction.id)
                        }}
                        className={cn(
                          'flex min-h-8 min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
                          factionActive ? 'text-emerald-200' : 'text-zinc-300 hover:text-zinc-100'
                        )}
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2">
                          <span className={cn('h-2 w-2 shrink-0 rounded-full', dotClass)} aria-hidden />
                          <span className="truncate">{faction.label}</span>
                        </span>
                        <span className="ml-2 shrink-0 font-mono text-[10px] text-zinc-500">{visibleShips.length}</span>
                      </button>
                    </div>

                    {factionExpanded && (
                      <div className="ml-3 mt-1.5 space-y-1 border-l border-white/10 pl-2.5">
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
                            className="flex min-h-8 w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[11px] text-zinc-300 transition-colors hover:bg-white/5 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40"
                          >
                            <span className="flex min-w-0 flex-1 items-center gap-2">
                              <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-500" />
                              <span className="truncate">{ship.name}</span>
                            </span>
                            <span className="ml-2 shrink-0 font-mono text-[10px] text-zinc-600">{ship.id}</span>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                  <ShipIcon className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-semibold tracking-tight text-white">
                    {t('fits.shipExplorer.title')}{' '}
                    <span className="text-primary">{t('fits.shipExplorer.version')}</span>
                  </DialogTitle>
                  <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                    {t('fits.shipExplorer.subtitle')}
                  </DialogDescription>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <div className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-primary" />
                    {t('fits.shipExplorer.statusLine')}
                  </div>
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
                                ? 'bg-blue-500/15 text-blue-300'
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
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">{t('fits.shipExplorer.quickFiltersLabel')}</span>
                {quickKeywordFilters.map((keyword) => (
                  <button
                    key={keyword.id}
                    type="button"
                    onClick={() => {
                      if (keyword.factionId) setActiveFaction(keyword.factionId)
                    }}
                    className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300 transition-colors hover:border-blue-500/40 hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  >
                    {keyword.label}
                  </button>
                ))}
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
                    className="h-7 rounded-full border border-white/10 px-3 text-[11px] text-zinc-300 hover:text-white"
                  >
                    {t('fits.shipExplorer.clearAll')}
                  </Button>
                )}
              </div>
              <p className="text-[11px] text-zinc-500">
                {t('fits.shipExplorer.treeHint')}
              </p>
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
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/30"
                    : "text-zinc-500 border-transparent hover:bg-white/5"
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
            <div className="mb-1.5 flex flex-wrap items-center gap-2 px-3.5">
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">{t('fits.shipExplorer.activeFiltersLabel')}</span>
              {activeGroupId !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveGroupId('all')}
                  className="inline-flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] text-blue-300"
                >
                  <Sparkles className="h-3 w-3" />
                  {activeGroupLabel ?? t('fits.shipExplorer.allClassesLabel')}
                  <X className="h-3 w-3" />
                </button>
              )}
              {activeFaction !== 'all' && (
                <button
                  type="button"
                  onClick={() => setActiveFaction('all')}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-300"
                >
                  <Sparkles className="h-3 w-3" />
                  {getShipFactionLabel(activeFaction)}
                  <X className="h-3 w-3" />
                </button>
              )}
              {search.trim().length > 0 && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-zinc-300"
                >
                  {`"${search}"`}
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="mb-1.5 px-3.5 text-xs text-zinc-500">
              {t('fits.shipExplorer.resultsCount', { count: filteredShips.length })}
            </div>
            <CommandList className="h-full max-h-none flex-1 overflow-y-auto overflow-x-hidden rounded-none border-0 bg-transparent p-0">
              <AnimatePresence mode="popLayout">
                {loading ? (
                  <div className="py-32 flex flex-col items-center justify-center space-y-4">
                    <Activity className="w-12 h-12 text-blue-500 animate-spin opacity-40" />
                    <p className="text-sm text-muted-foreground">{t('fits.shipExplorer.loadingShips')}</p>
                  </div>
                ) : filteredShips.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10">
                    {filteredShips.map((ship, idx) => (
                      <motion.div
                        layout
                        key={ship.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.015, 0.3) }}
                        className="min-w-0"
                      >
                        <CommandItem
                          value={`${ship.id}-${ship.name}`}
                          onSelect={() => selectShip(ship)}
                          className="group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 text-left transition-colors data-[selected=true]:border-blue-500/50 data-[selected=true]:bg-blue-500/10 aria-selected:bg-blue-500/10"
                        >
                          <div className="relative flex aspect-square w-full items-center justify-center bg-gradient-to-b from-zinc-900 to-black/60 p-1.5">
                            <div className="absolute inset-x-2 bottom-0 h-1/2 bg-gradient-to-t from-blue-500/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                            {imgErrors[ship.id] || ship.id <= 1 ? (
                              <ShipIcon className="h-1/2 w-1/2 text-zinc-700 opacity-60" />
                            ) : (
                              <Image
                                src={`https://images.evetech.net/types/${ship.id}/render?size=256`}
                                alt={ship.name}
                                width={256}
                                height={256}
                                className="h-full w-full object-contain drop-shadow(0 4px 8px rgba(0,0,0,0.45)) transition-transform duration-300 group-hover:scale-105"
                                onError={() => handleImgError(ship.id)}
                              />
                            )}
                            {ship.faction && (
                              <div
                                className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-blue-500/60 shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                                title={getShipFactionLabel(ship.factionId ?? normalizeShipFactionId(ship.faction))}
                              />
                            )}
                            <div className="absolute right-1.5 top-1.5 opacity-0 transition-all group-hover:opacity-100">
                              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600/90 shadow-lg">
                                <Check className="h-3 w-3 text-white/95" />
                              </div>
                            </div>
                          </div>
                          <div className="border-t border-white/10 bg-zinc-950/95 px-2 py-1.5 transition-colors group-hover:bg-blue-600/10">
                            <div
                              className="line-clamp-1 text-[12px] font-semibold leading-snug text-foreground group-hover:text-blue-200"
                              title={ship.name}
                            >
                              {ship.name}
                            </div>
                            <div
                              className="line-clamp-1 text-[10px] leading-tight text-zinc-400 transition-colors group-hover:text-zinc-300"
                              title={ship.groupName}
                            >
                              {ship.groupName}
                            </div>
                            <div className="mt-0.5 text-[9px] text-zinc-600">
                              #{ship.id}
                            </div>
                          </div>
                          <div className="pointer-events-none absolute inset-0 rounded-xl border border-transparent group-hover:border-blue-500/20" />
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

        {/* Inventory Status Bar */}
        <div className="flex h-10 items-center justify-between border-t border-white/10 bg-black/80 px-4 text-[11px] text-muted-foreground sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
            <span className="truncate">{t('fits.shipExplorer.footerHulls', { count: filteredShips.length })}</span>
            <span className="hidden truncate sm:inline">
              {t('fits.shipExplorer.footerClass', {
                name:
                  activeGroupId === 'all'
                    ? t('fits.shipExplorer.allClassesLabel')
                    : (activeGroupLabel ?? t('fits.shipExplorer.allClassesLabel')),
              })}
            </span>
            <span className="hidden truncate md:inline">
              {t('fits.shipExplorer.footerFaction', {
                name:
                  activeFaction === 'all'
                    ? t('fits.shipExplorer.allFactionsLabel')
                    : getShipFactionLabel(activeFaction),
              })}
            </span>
          </div>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-primary" />
            {t('fits.shipExplorer.footerReady')}
          </span>
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
