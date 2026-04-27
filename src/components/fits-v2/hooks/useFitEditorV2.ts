'use client'

import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Fit, Module, ShipStats } from '@/types/fit'
import { ModuleInfo } from '@/components/fits/modules/types'
import type { FitsV2Response, FitsV2ResolveResponse } from '@/lib/fits-v2/types-v2'
import { firstFreeSlotIndex, formatV2Errors } from '@/lib/fits-v2/fit-editor-utils'

export interface UseFitEditorV2Result {
  id: string | null
  loading: boolean
  saving: boolean
  calculating: boolean
  activeSlotIndex: number | null
  setActiveSlotIndex: (v: number | null) => void
  highlightedSection: 'high' | 'med' | 'low' | 'rig' | null
  setHighlightedSection: (v: 'high' | 'med' | 'low' | 'rig' | null) => void
  fit: Partial<Fit>
  setFit: React.Dispatch<React.SetStateAction<Partial<Fit>>>
  stats: ShipStats | null
  eftInput: string
  setEftInput: (v: string) => void
  importOpen: boolean
  setImportOpen: (v: boolean) => void
  shipSelectorOpen: boolean
  setShipSelectorOpen: (v: boolean) => void
  newTag: string
  setNewTag: (v: string) => void
  chargeModalOpen: boolean
  setChargeModalOpen: (v: boolean) => void
  selectedModuleForCharge: {
    slotType: 'high' | 'med' | 'low' | 'rig'
    slotIndex: number
    module: Module
  } | null
  setSelectedModuleForCharge: Dispatch<
    SetStateAction<{
      slotType: 'high' | 'med' | 'low' | 'rig'
      slotIndex: number
      module: Module
    } | null>
  >
  compatibilityMap: Record<number, { isCompatible: boolean; restriction?: string }>
  slotCounts: { high: number; med: number; low: number; rig: number }
  incompatibleCount: number
  shipDataWarning: string | null
  addTag: () => void
  removeTag: (tag: string) => void
  handleImport: () => Promise<void>
  handleToggleOffline: (index: number) => void
  handleRemoveModule: (index: number) => void
  handleRemoveDrone: (index: number) => void
  handleRemoveCargo: (index: number) => void
  handleShipSelect: (ship: { id: number; name: string }) => void
  handleItemFit: (item: ModuleInfo) => Promise<void>
  handleModuleAdd: (slotType: string, slotIndex: number) => void
  handleModuleRightClick: (slotType: string, slotIndex: number, module: Module) => void
  handleModuleDrop: (slotType: string, slotIndex: number, item: ModuleInfo) => Promise<void>
  handleChargeSelect: (
    charge: { id?: number; typeId?: number; name?: string } | null
  ) => Promise<void>
  handleSave: () => Promise<void>
  handleUnfitModule: (slotType: string, slotIndex: number) => Promise<void>
  toggleVisibility: () => void
}

export function useFitEditorV2(): UseFitEditorV2Result {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')

  const [loading, setLoading] = useState(!!id)
  const [saving, setSaving] = useState(false)
  const [calculating, setCalculating] = useState(false)
  const [activeSlotIndex, setActiveSlotIndex] = useState<number | null>(null)
  const [highlightedSection, setHighlightedSection] = useState<'high' | 'med' | 'low' | 'rig' | null>(null)
  const [fit, setFit] = useState<Partial<Fit>>({
    name: 'New Fit',
    ship: 'Select a Ship',
    shipId: 0,
    modules: [],
    drones: [],
    fighters: [],
    cargo: [],
    tags: [],
    visibility: 'PROTECTED',
  })

  const [stats, setStats] = useState<ShipStats | null>(null)
  const [eftInput, setEftInput] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [shipSelectorOpen, setShipSelectorOpen] = useState(false)
  const [newTag, setNewTag] = useState('')

  const [chargeModalOpen, setChargeModalOpen] = useState(false)
  const [selectedModuleForCharge, setSelectedModuleForCharge] = useState<{
    slotType: 'high' | 'med' | 'low' | 'rig'
    slotIndex: number
    module: Module
  } | null>(null)

  const [compatibilityMap, setCompatibilityMap] = useState<
    Record<number, { isCompatible: boolean; restriction?: string }>
  >({})

  useEffect(() => {
    const fetchCompatibility = async () => {
      if (!stats?.groupId && !fit.shipId) {
        setCompatibilityMap({})
        return
      }

      try {
        const params = new URLSearchParams({
          shipGroupId: (stats?.groupId || 0).toString(),
          shipTypeId: (fit.shipId || 0).toString(),
        })
        if (stats?.rigSize || fit.rigSize) {
          params.append('rigSize', (stats?.rigSize || fit.rigSize || 0).toString())
        }

        const res = await fetch(`/api/modules/compatibility?${params.toString()}`)
        if (!res.ok) return
        const data = await res.json()

        const map: Record<number, { isCompatible: boolean; restriction?: string }> = {}
        for (const [typeId, compat] of Object.entries(data.compatibility)) {
          const c = compat as { isCompatible?: boolean; restriction?: string; reason?: string }
          map[Number(typeId)] = {
            isCompatible: c.isCompatible !== false,
            restriction: c.restriction || c.reason,
          }
        }
        setCompatibilityMap(map)
      } catch (err) {
        console.error('Compatibility check failed:', err)
        setCompatibilityMap({})
      }
    }
    fetchCompatibility()
  }, [stats?.groupId, stats?.rigSize, fit.shipId, fit.rigSize])

  useEffect(() => {
    if (id) {
      const fetchFit = async () => {
        try {
          const res = await fetch(`/api/fits/${id}`)
          if (!res.ok) throw new Error('Fit not found')
          const data = await res.json()
          setFit(data)
        } catch {
          toast.error('Failed to load fit')
          router.push('/dashboard/fits')
        } finally {
          setLoading(false)
        }
      }
      fetchFit()
    }
  }, [id, router])

  useEffect(() => {
    if (searchParams.get('import') === 'eft') {
      setImportOpen(true)
      const next = new URLSearchParams(searchParams.toString())
      next.delete('import')
      const qs = next.toString()
      router.replace(qs ? `/dashboard/fits/editor?${qs}` : '/dashboard/fits/editor', { scroll: false })
    }
  }, [searchParams, router])

  useEffect(() => {
    if (searchParams.get('new') === 'true' && !id && fit.shipId === 0) {
      setShipSelectorOpen(true)
    }
  }, [searchParams, id, fit.shipId])

  useEffect(() => {
    if (!fit.shipId) {
      setStats(null)
      return
    }

    const calculate = async () => {
      setCalculating(true)
      try {
        const res = await fetch('/api/fits/v2/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shipTypeId: fit.shipId,
            modules: fit.modules,
            drones: fit.drones,
            cargo: fit.cargo,
          }),
        })
        const data = (await res.json()) as FitsV2Response
        if (res.ok && data.stats) {
          setStats(data.stats)
        } else {
          const message = formatV2Errors(data, 'Validation failed')
          console.error('Fits v2 validate failed', message)
        }
      } catch (err) {
        console.error('Calculation failed', err)
      } finally {
        setCalculating(false)
      }
    }

    const timer = setTimeout(calculate, 500)
    return () => clearTimeout(timer)
  }, [fit.shipId, fit.modules, fit.drones, fit.cargo])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return

      const key = e.key.toLowerCase()
      const slotMap: Record<string, 'high' | 'med' | 'low' | 'rig'> = {
        '1': 'high',
        '2': 'high',
        '3': 'high',
        '4': 'high',
        '5': 'med',
        '6': 'med',
        '7': 'low',
        '8': 'rig',
      }

      if (slotMap[key]) {
        const slotType = slotMap[key]
        window.dispatchEvent(new CustomEvent('quickAddModule', { detail: { slotType } }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const addTag = useCallback(() => {
    setFit((p) => {
      const tag = newTag.trim()
      if (!tag || p.tags?.includes(tag)) return p
      return { ...p, tags: [...(p.tags || []), tag] }
    })
    setNewTag('')
  }, [newTag])

  const removeTag = useCallback((tagToRemove: string) => {
    setFit((p) => ({ ...p, tags: p.tags?.filter((t) => t !== tagToRemove) }))
  }, [])

  const handleImport = useCallback(async () => {
    if (!eftInput.trim()) return

    setSaving(true)
    try {
      const res = await fetch('/api/fits/v2/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eft: eftInput }),
      })
      const resolved = (await res.json()) as FitsV2ResolveResponse
      if (!res.ok) {
        throw new Error(formatV2Errors(resolved, 'Failed to parse EFT'))
      }
      setFit((prev) => ({
        ...prev,
        name: resolved.name ?? prev.name,
        ship: resolved.ship ?? prev.ship,
        shipId: resolved.shipId ?? resolved.state.shipTypeId ?? prev.shipId,
        modules: resolved.state.modules,
        drones: resolved.state.drones,
        cargo: resolved.state.cargo,
      }))
      if (resolved.stats) setStats(resolved.stats)
      setImportOpen(false)
      setEftInput('')
      toast.success('Fit imported from EFT')
    } catch {
      toast.error('Invalid EFT or ship not found')
    } finally {
      setSaving(false)
    }
  }, [eftInput])

  const handleToggleOffline = useCallback((index: number) => {
    setFit((prev) => {
      const modules = [...(prev.modules || [])]
      if (modules[index]) {
        modules[index] = { ...modules[index], offline: !modules[index].offline }
      }
      return { ...prev, modules }
    })
  }, [])

  const handleRemoveModule = useCallback((index: number) => {
    setFit((prev) => ({
      ...prev,
      modules: prev.modules?.filter((_, i) => i !== index),
    }))
    toast.info('Module removed')
  }, [])

  const handleRemoveDrone = useCallback((index: number) => {
    setFit((prev) => ({
      ...prev,
      drones: prev.drones?.filter((_, i) => i !== index),
    }))
    toast.info('Drone removed')
  }, [])

  const handleRemoveCargo = useCallback((index: number) => {
    setFit((prev) => ({
      ...prev,
      cargo: prev.cargo?.filter((_, i) => i !== index),
    }))
    toast.info('Item removed from cargo')
  }, [])

  const handleShipSelect = useCallback((ship: { id: number; name: string }) => {
    setFit((prev) => ({
      ...prev,
      ship: ship.name,
      shipId: ship.id,
      modules: [],
      drones: [],
      cargo: [],
    }))
    toast.info(`Hull set to ${ship.name}`)
  }, [])

  const slotCounts = useMemo(
    () => ({
      high: fit.modules?.filter((m) => m.slot === 'high').length || 0,
      med: fit.modules?.filter((m) => m.slot === 'med').length || 0,
      low: fit.modules?.filter((m) => m.slot === 'low').length || 0,
      rig: fit.modules?.filter((m) => m.slot === 'rig').length || 0,
    }),
    [fit.modules]
  )

  const incompatibleCount = useMemo(() => {
    let count = 0
    fit.modules?.forEach((m: Module) => {
      if (compatibilityMap[m.typeId]?.isCompatible === false) {
        count++
      }
    })
    return count
  }, [fit.modules, compatibilityMap])

  const shipDataWarning = useMemo(() => {
    if (!stats?.validation?.warnings?.length) return null
    return (
      stats.validation.warnings.find((w) =>
        w.toLowerCase().includes('ship identity partially resolved')
      ) || null
    )
  }, [stats?.validation?.warnings])

  const handleItemFit = useCallback(
    async (item: ModuleInfo) => {
      if (!fit.shipId) {
        toast.error('Select a ship first')
        return
      }

      const groupName = (item.groupName || '').toLowerCase()
      const categoryName = (item.categoryName || '').toLowerCase()
      const isDrone = Boolean(item.isDrone) || categoryName.includes('drone') || groupName.includes('drone')
      const isCharge =
        Boolean(item.isCharge) ||
        categoryName.includes('charge') ||
        groupName.includes('ammo') ||
        groupName.includes('script') ||
        groupName.includes('charge')

      if (isDrone) {
        setFit((prev) => ({
          ...prev,
          drones: [...(prev.drones || []), { id: item.typeId, name: item.name, quantity: 1 }],
        }))
        toast.success(`Added ${item.name} to drone bay`)
        return
      }

      if (isCharge) {
        setFit((prev) => ({
          ...prev,
          cargo: [...(prev.cargo || []), { id: item.typeId, name: item.name, quantity: 100 }],
        }))
        toast.success(`Added ${item.name} to cargo`)
        return
      }

      let targetSlotType = item.slotType || ''

      if (!targetSlotType) {
        toast.error('Unsupported item classification', {
          description: `${item.name} has no valid slot type and cannot be auto-fitted.`,
        })
        return
      }

      const isHardwareSlot = ['high', 'med', 'low', 'rig', 'subsystem'].includes(targetSlotType)

      if (isHardwareSlot && stats) {
        if (isDrone) {
          toast.error('Invalid slot', {
            description: 'Drones must go in the drone bay, not in rack slots.',
          })
          return
        }

        if (!fit.shipId || fit.shipId === 0) {
          toast.error('Hull required', {
            description: 'Select a ship before fitting modules.',
          })
          return
        }

        const typeId = Number(item.typeId || item.id)
        const compat = compatibilityMap[typeId]

        if (compat && !compat.isCompatible) {
          toast.error('Incompatible module', {
            description: compat.restriction || `${item.name} cannot be fitted on this hull.`,
          })
          return
        }

        if (item.slotType && item.slotType !== targetSlotType) {
          toast.error('Invalid slot', {
            description: `${item.name} belongs in a ${item.slotType.toUpperCase()} slot, not ${targetSlotType.toUpperCase()}.`,
          })
          return
        }
      }

      if (!isHardwareSlot) {
        toast.error('Invalid slot type', {
          description: `${item.name} is classified as "${targetSlotType}" and cannot be fitted in racks.`,
        })
        return
      }

      const maxSlots = stats?.slots?.[targetSlotType as keyof ShipStats['slots']]?.total || 0
      const mods = fit.modules || []
      const currentCount = slotCounts[targetSlotType as keyof typeof slotCounts] || 0
      if (currentCount >= maxSlots) {
        toast.error(`No ${targetSlotType} slots available`, {
          description: `This ship only has ${maxSlots} ${targetSlotType} slots`,
        })
        return
      }

      const targetIndex =
        activeSlotIndex !== null
          ? activeSlotIndex
          : firstFreeSlotIndex(
              targetSlotType as 'high' | 'med' | 'low' | 'rig' | 'subsystem',
              maxSlots,
              mods
            )

      const res = await fetch('/api/fits/v2/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fitModule',
          shipTypeId: fit.shipId,
          modules: mods,
          drones: fit.drones || [],
          cargo: fit.cargo || [],
          slot: targetSlotType,
          slotIndex: targetIndex,
          module: {
            typeId: item.typeId || (item as { id?: number }).id,
            name: item.name,
          },
        }),
      })
      const data = (await res.json()) as FitsV2Response
      if (!res.ok || !data.stats || !data.success) {
        toast.error('Fit rejected', {
          description: formatV2Errors(data, data.success ? res.statusText : 'Mutation violates fit rules'),
        })
        return
      }
      setFit((prev) => ({
        ...prev,
        shipId: data.state.shipTypeId,
        modules: data.state.modules,
        drones: data.state.drones,
        cargo: data.state.cargo,
      }))
      setStats(data.stats)
      setActiveSlotIndex(null)
      setHighlightedSection(null)
      toast.success(`Fitted ${item.name}`)
    },
    [fit.shipId, fit.modules, fit.drones, fit.cargo, stats, compatibilityMap, slotCounts, activeSlotIndex]
  )

  const handleModuleAdd = useCallback((slotType: string, slotIndex: number) => {
    setHighlightedSection(slotType as 'high' | 'med' | 'low' | 'rig')
    setActiveSlotIndex(slotIndex)
    window.dispatchEvent(new CustomEvent('filterModules', { detail: { slotType } }))
    toast.info(`Pick a module for ${slotType.toUpperCase()} slot ${slotIndex + 1}`)
  }, [])

  const handleModuleRightClick = useCallback((slotType: string, slotIndex: number, module: Module) => {
    setSelectedModuleForCharge({ slotType: slotType as 'high' | 'med' | 'low' | 'rig', slotIndex, module })
    setChargeModalOpen(true)
  }, [])

  const handleModuleDrop = useCallback(
    async (slotType: string, slotIndex: number, item: ModuleInfo) => {
      if (!item) return

      const groupName = (item.groupName || '').toLowerCase()
      const categoryName = (item.categoryName || '').toLowerCase()

      const isDrone = categoryName.includes('drone') || groupName.includes('drone')
      const isCharge = categoryName.includes('charge') || groupName.includes('ammo') || groupName.includes('script')

      if (isDrone || isCharge) {
        toast.error('Invalid operation', {
          description: `${item.name} cannot be dropped into a rack slot.`,
        })
        return
      }

      if (!fit.ship) {
        toast.error('Hull required', {
          description: 'Select a ship before fitting modules.',
        })
        return
      }

      const typeId = Number(item.typeId || item.id)
      const compat = compatibilityMap[typeId]

      if (compat && !compat.isCompatible) {
        toast.error('Incompatible module', {
          description: compat.restriction || `${item.name} cannot be fitted on this hull.`,
        })
        return
      }

      if (item.slotType) {
        const normalizedItemSlot = item.slotType.toLowerCase().replace(' slot', '').trim()
        const normalizedTargetSlot = slotType.toLowerCase().trim()

        if (normalizedItemSlot !== normalizedTargetSlot) {
          toast.error('Invalid slot', {
            description: `${item.name} belongs in a ${item.slotType.toUpperCase()} slot, not ${slotType.toUpperCase()}.`,
          })
          return
        }
      }

      const maxSlots = stats?.slots?.[slotType as keyof ShipStats['slots']]?.total || 0
      const currentFitted = (fit.modules || []).filter((m) => m.slot === slotType).length

      if (currentFitted >= maxSlots) {
        toast.error('No slots available', {
          description: `This ship only has ${maxSlots} ${slotType.toUpperCase()} slots.`,
        })
        return
      }

      const res = await fetch('/api/fits/v2/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'fitModule',
          shipTypeId: fit.shipId,
          modules: fit.modules || [],
          drones: fit.drones || [],
          cargo: fit.cargo || [],
          slot: slotType,
          slotIndex,
          module: {
            typeId: Number(item.typeId || item.id),
            name: item.name,
          },
        }),
      })
      const data = (await res.json()) as FitsV2Response
      if (!res.ok || !data.stats || !data.success) {
        toast.error('Fit rejected', {
          description: formatV2Errors(data, data.success ? res.statusText : 'Mutation violates fit rules'),
        })
        return
      }
      setFit((prev) => ({
        ...prev,
        shipId: data.state.shipTypeId,
        modules: data.state.modules,
        drones: data.state.drones,
        cargo: data.state.cargo,
      }))
      setStats(data.stats)
      setHighlightedSection(null)
      toast.success(`Fitted to ${slotType.toUpperCase()} ${slotIndex + 1}`)
    },
    [fit.ship, fit.shipId, fit.modules, fit.drones, fit.cargo, stats, compatibilityMap]
  )

  const handleChargeSelect = useCallback(
    async (charge: { id?: number; typeId?: number; name?: string } | null) => {
      if (!selectedModuleForCharge || !fit.shipId) return

      const res = await fetch('/api/fits/v2/mutate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'setCharge',
          shipTypeId: fit.shipId,
          modules: fit.modules || [],
          drones: fit.drones || [],
          cargo: fit.cargo || [],
          slot: selectedModuleForCharge.slotType,
          slotIndex: selectedModuleForCharge.slotIndex,
          charge: charge
            ? {
                id: Number(charge.id ?? charge.typeId),
                name: charge.name || '',
                quantity: 1,
              }
            : null,
        }),
      })
      const data = (await res.json()) as FitsV2Response
      setChargeModalOpen(false)
      if (!res.ok || !data.stats || !data.success) {
        toast.error('Charge rejected', {
          description: formatV2Errors(data, data.success ? res.statusText : 'Charge violates fit rules'),
        })
        return
      }
      setFit((prev) => ({
        ...prev,
        shipId: data.state.shipTypeId,
        modules: data.state.modules,
        drones: data.state.drones,
        cargo: data.state.cargo,
      }))
      setStats(data.stats)
      toast.success(charge ? `Loaded ${charge.name}` : 'Ammo cleared')
    },
    [selectedModuleForCharge, fit.shipId, fit.modules, fit.drones, fit.cargo]
  )

  const handleSave = useCallback(async () => {
    if (!fit.name) {
      toast.error('Fit name is required')
      return
    }

    setSaving(true)
    try {
      const method = id ? 'PUT' : 'POST'
      const url = id ? `/api/fits/${id}` : '/api/fits'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fit),
      })

      if (!res.ok) throw new Error('Failed to save fit')

      const savedFit = await res.json()
      toast.success('Fit saved')
      if (!id) router.push(`/dashboard/fits/editor?id=${savedFit.id}`)
    } catch {
      toast.error('Could not save fit')
    } finally {
      setSaving(false)
    }
  }, [fit, id, router])

  const handleUnfitModule = useCallback(
    async (slotType: string, slotIndex: number) => {
      if (!fit.shipId) {
        toast.error('Select a hull first')
        return
      }
      try {
        const res = await fetch('/api/fits/v2/mutate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unfitModule',
            shipTypeId: fit.shipId,
            modules: fit.modules || [],
            drones: fit.drones || [],
            cargo: fit.cargo || [],
            slot: slotType,
            slotIndex,
          }),
        })
        const data = (await res.json()) as FitsV2Response
        if (!res.ok || !data.stats || !data.success) {
          toast.error('Unfit rejected', {
            description: formatV2Errors(data, data.success ? res.statusText : 'Mutation violates fit rules'),
          })
          return
        }
        setFit((prev) => ({
          ...prev,
          shipId: data.state.shipTypeId,
          modules: data.state.modules,
          drones: data.state.drones,
          cargo: data.state.cargo,
        }))
        setStats(data.stats)
        toast.info('Module removed')
      } catch {
        toast.error('Unfit failed')
      }
    },
    [fit.shipId, fit.modules, fit.drones, fit.cargo]
  )

  const toggleVisibility = useCallback(() => {
    const next = fit.visibility === 'PUBLIC' ? 'PROTECTED' : 'PUBLIC'
    setFit((p) => ({ ...p, visibility: next }))
    toast.info(`Visibility: ${next}`)
  }, [fit.visibility])

  return {
    id,
    loading,
    saving,
    calculating,
    activeSlotIndex,
    setActiveSlotIndex,
    highlightedSection,
    setHighlightedSection,
    fit,
    setFit,
    stats,
    eftInput,
    setEftInput,
    importOpen,
    setImportOpen,
    shipSelectorOpen,
    setShipSelectorOpen,
    newTag,
    setNewTag,
    chargeModalOpen,
    setChargeModalOpen,
    selectedModuleForCharge,
    setSelectedModuleForCharge,
    compatibilityMap,
    slotCounts,
    incompatibleCount,
    shipDataWarning,
    addTag,
    removeTag,
    handleImport,
    handleToggleOffline,
    handleRemoveModule,
    handleRemoveDrone,
    handleRemoveCargo,
    handleShipSelect,
    handleItemFit,
    handleModuleAdd,
    handleModuleRightClick,
    handleModuleDrop,
    handleChargeSelect,
    handleSave,
    handleUnfitModule,
    toggleVisibility,
  }
}
