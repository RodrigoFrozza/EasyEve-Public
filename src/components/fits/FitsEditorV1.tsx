'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeft, Cpu, Save, Import, Activity, 
  Plus, Trash2, Globe, Lock, AlertTriangle, X, Zap, Copy, Loader2
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog'

import { ShipSelector } from '@/components/fits/ShipSelector'
import { CircularSlotVisualizer } from '@/components/fits/CircularSlotVisualizer'
import { ModuleBrowserPanel } from '@/components/fits/ModuleBrowserPanel'
import { ShipAttributesPanel } from '@/components/fits/attributes'
import { ChargeSelector } from '@/components/fits/context-menu/ChargeSelector'
import { Fit, Module, ShipStats } from '@/types/fit'
import { ModuleInfo } from '@/components/fits/modules/types'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

function firstFreeSlotIndex(
  slotType: 'high' | 'med' | 'low' | 'rig' | 'subsystem',
  max: number,
  mods: Module[]
): number {
  const used = new Set(
    mods.filter((m) => m.slot === slotType).map((m) => m.slotIndex ?? 0)
  )
  for (let i = 0; i < max; i++) {
    if (!used.has(i)) return i
  }
  return Math.max(0, max - 1)
}

function FitEditorContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = searchParams.get('id')
  const { t } = useTranslations()

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

  const [compatibilityMap, setCompatibilityMap] = useState<Record<number, { isCompatible: boolean; restriction?: string }>>({})

  // Fetch compatibility map when ship group or rig size changes
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
          const c = compat as { isCompatible: boolean; restriction?: string }
          map[Number(typeId)] = c
        }
        setCompatibilityMap(map)
      } catch (err) {
        console.error('Compatibility check failed:', err)
        setCompatibilityMap({})
      }
    }
    fetchCompatibility()
  }, [stats?.groupId, stats?.rigSize, fit.shipId, fit.rigSize])

  // Load existing fit
  useEffect(() => {
    if (id) {
      const fetchFit = async () => {
        try {
          const res = await fetch(`/api/fits/${id}`)
          if (!res.ok) throw new Error('Fit not found')
          const data = await res.json()
          setFit(data)
        } catch (err) {
          toast.error('Failed to load fit')
          router.push('/dashboard/fits')
        } finally {
          setLoading(false)
        }
      }
      fetchFit()
    }
  }, [id, router])

  // Automatically open ship selector for new fits
  useEffect(() => {
    if (searchParams.get('new') === 'true' && !id && fit.shipId === 0) {
      setShipSelectorOpen(true)
    }
  }, [searchParams, id, fit.shipId])

  // Recalculate stats when ship or modules change
  useEffect(() => {
    if (!fit.shipId) {
      setStats(null)
      return
    }

    const calculate = async () => {
      setCalculating(true)
      try {
        const res = await fetch('/api/fits/calculate', {
          method: 'POST',
          body: JSON.stringify({
            shipTypeId: fit.shipId,
            modules: fit.modules,
            drones: fit.drones,
            cargo: fit.cargo,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        } else {
          let message = 'Calculation failed'
          try {
            const err = await res.json()
            if (Array.isArray(err.errors)) message = err.errors.join('; ')
          } catch {
            /* ignore */
          }
          console.error('Calculation failed', message)
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

  // Hotkeys for quick-add modules
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return
      
      const key = e.key.toLowerCase()
      const slotMap: Record<string, 'high' | 'med' | 'low' | 'rig'> = {
        '1': 'high', '2': 'high', '3': 'high', '4': 'high',
        '5': 'med', '6': 'med',
        '7': 'low', '8': 'rig'
      }
      
      if (slotMap[key]) {
        const slotType = slotMap[key]
        const event = new CustomEvent('quickAddModule', { detail: { slotType } })
        window.dispatchEvent(event)
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const addTag = () => {
    const tag = newTag.trim()
    if (!tag) return
    if (fit.tags?.includes(tag)) {
      setNewTag('')
      return
    }
    setFit(p => ({ ...p, tags: [...(p.tags || []), tag] }))
    setNewTag('')
  }

  const removeTag = (tagToRemove: string) => {
    setFit(p => ({ ...p, tags: p.tags?.filter(t => t !== tagToRemove) }))
  }

  const handleImport = async () => {
    if (!eftInput.trim()) return
    
    setSaving(true)
    try {
      const res = await fetch('/api/fits/resolve', {
        method: 'POST',
        body: JSON.stringify({ eft: eftInput })
      })
      const resolved = await res.json()
      if (!res.ok) {
        throw new Error(
          [resolved.error, ...(resolved.errors || [])].filter(Boolean).join(': ') ||
            'Failed to parse EFT'
        )
      }
      setFit(prev => ({ ...prev, ...resolved }))
      if (resolved.esiData) setStats(resolved.esiData)
      setImportOpen(false)
      setEftInput('')
      toast.success('Fit imported successfully!')
    } catch (err) {
      toast.error('Invalid EFT string or ship not found')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleOffline = (index: number) => {
    setFit(prev => {
      const modules = [...(prev.modules || [])]
      if (modules[index]) {
        modules[index] = { ...modules[index], offline: !modules[index].offline }
      }
      return { ...prev, modules }
    })
  }

  const handleRemoveModule = (index: number) => {
    setFit(prev => ({
      ...prev,
      modules: prev.modules?.filter((_, i) => i !== index)
    }))
    toast.info('Module removed')
  }

  const handleRemoveDrone = (index: number) => {
    setFit(prev => ({
      ...prev,
      drones: prev.drones?.filter((_, i) => i !== index)
    }))
    toast.info('Drone removed')
  }

  const handleRemoveCargo = (index: number) => {
    setFit(prev => ({
      ...prev,
      cargo: prev.cargo?.filter((_, i) => i !== index)
    }))
    toast.info('Item removed from cargo')
  }

  const handleShipSelect = (ship: { id: number; name: string }) => {
    setFit(prev => ({
      ...prev,
      ship: ship.name,
      shipId: ship.id,
      modules: [],
      drones: [],
      cargo: []
    }))
    toast.info(`Switched chassis to ${ship.name}`)
  }

  const slotCounts = useMemo(() => ({
    high: fit.modules?.filter(m => m.slot === 'high').length || 0,
    med: fit.modules?.filter(m => m.slot === 'med').length || 0,
    low: fit.modules?.filter(m => m.slot === 'low').length || 0,
    rig: fit.modules?.filter(m => m.slot === 'rig').length || 0
  }), [fit.modules])

  const incompatibleCount = useMemo(() => {
    let count = 0
    fit.modules?.forEach((m: any) => {
      if (compatibilityMap[m.typeId]?.isCompatible === false) {
        count++
      }
    })
    return count
  }, [fit.modules, compatibilityMap])

  const handleItemFit = async (item: ModuleInfo) => {
    if (!fit.shipId) {
      toast.error('Select a ship first')
      return
    }

    const groupName = (item.groupName || '').toLowerCase()
    const categoryName = (item.categoryName || '').toLowerCase()

    // 1. DRONE/FIGHTER/CHARGE CHECK (HIGHEST PRIORITY)
    if (item.isDrone) {
      setFit(prev => ({
        ...prev,
        drones: [...(prev.drones || []), { 
          id: item.typeId, 
          name: item.name, 
          quantity: 1
        }]
      }))
      toast.success(`Added ${item.name} to Drone Bay`)
      return
    }

    if (item.isCharge) {
      setFit(prev => ({
        ...prev,
        cargo: [...(prev.cargo || []), {
          id: item.typeId,
          name: item.name,
          quantity: 100 // Default quantity for ammo
        }]
      }))
      toast.success(`Added ${item.name} to Cargo`)
      return
    }

    let targetSlotType = item.slotType || ''
    
    if (!targetSlotType) {
      if (groupName.includes('rig')) {
        targetSlotType = 'rig'
      } else if (groupName.includes('subsystem')) {
        targetSlotType = 'subsystem'
      } else {
        targetSlotType = 'cargo'
      }
    }
    
    const isHardwareSlot = ['high', 'med', 'low', 'rig', 'subsystem'].includes(targetSlotType)
    
    // 2. HARDWARE COMPATIBILITY GUARDS (Local Pre-validation)
    if (isHardwareSlot && stats) {

      // Drone Bay enforcement
      if (item.isDrone) {
        toast.error(`Invalid Slot`, {
          description: `Drones and Fighters must be placed in the Drone Bay, not in hardware slots.`
        })
        return
      }

      if (!fit.shipId || fit.shipId === 0) {
        toast.error(`Chassis Required`, {
          description: `Select a ship chassis before attempting to fit modules.`
        })
        return
      }

      // Authoritative Check: Chassis Compatibility
      const typeId = Number(item.typeId || item.id)
      const compat = compatibilityMap[typeId]

      // Removed duplicate declaration

        if (compat && !compat.isCompatible) {
        toast.error(`Incompatible Module`, {
          description: compat.restriction || `${item.name} cannot be fitted to this chassis.`
        })
        return
      }

      // Authoritative Check: Slot Type Compatibility
      if (item.slotType && item.slotType !== targetSlotType) {
        toast.error(`Invalid Slot`, {
          description: `${item.name} belongs in a ${item.slotType.toUpperCase()} slot, not ${targetSlotType.toUpperCase()}.`
        })
        return
      }
    }

    if (isHardwareSlot) {
      if (item.isCharge) {
        targetSlotType = 'charge'
      }
    }

    if (targetSlotType === 'charge' || targetSlotType === 'cargo') {
      setFit(prev => ({
        ...prev,
        cargo: [...(prev.cargo || []), { 
          id: item.typeId, 
          name: item.name, 
          quantity: 1
        }]
      }))
      toast.success(`Added ${item.name} to Cargo Hold`)
      return
    }

    const maxSlots = stats?.slots?.[targetSlotType as keyof ShipStats['slots']]?.total || 0
    const mods = fit.modules || []
    const currentCount = slotCounts[targetSlotType as keyof typeof slotCounts] || 0
    if (currentCount >= maxSlots) {
      toast.error(`No ${targetSlotType.toUpperCase()} slots available`, {
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

    const res = await fetch('/api/fits/mutate', {
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
    const data = await res.json()
    if (!res.ok || !data.stats) {
      toast.error('Fit rejected', {
        description: (data.errors || []).join('; ') || res.statusText,
      })
      return
    }
    setFit((prev) => ({
      ...prev,
      modules: data.modules,
      drones: data.drones,
      cargo: data.cargo,
    }))
    setStats(data.stats)
    setActiveSlotIndex(null)
    if (data.success) {
      toast.success(`Fitted ${item.name}`)
    } else {
      toast.error('Invalid fit', { description: (data.errors || []).join('; ') })
    }
  }

  const handleModuleAdd = (slotType: string, slotIndex: number) => {
    setHighlightedSection(slotType as any)
    setActiveSlotIndex(slotIndex)
    const event = new CustomEvent('filterModules', { detail: { slotType } })
    window.dispatchEvent(event)
    toast.info(`Select a module for ${slotType.toUpperCase()} slot ${slotIndex + 1}`)
  }

  const handleModuleRightClick = (slotType: string, slotIndex: number, module: Module) => {
    setSelectedModuleForCharge({ slotType: slotType as any, slotIndex, module })
    setChargeModalOpen(true)
  }

  const handleModuleDrop = async (slotType: string, slotIndex: number, item: ModuleInfo) => {
    if (!item) return

    const groupName = (item.groupName || '').toLowerCase()
    const categoryName = (item.categoryName || '').toLowerCase()
    
    // Strict item type isolation
    const isDrone = categoryName.includes('drone') || groupName.includes('drone')
    const isCharge = categoryName.includes('charge') || groupName.includes('ammo') || groupName.includes('script')
    
    if (isDrone || isCharge) {
      toast.error(`Invalid Operation`, {
        description: `${item.name} cannot be fitted into a hardware slot.`
      })
      return
    }

    if (!fit.ship) {
      toast.error(`Chassis Required`, {
        description: `Select a ship before attempting to fit modules.`
      })
      return
    }

    const typeId = Number(item.typeId || item.id)
    const compat = compatibilityMap[typeId]

    if (compat && !compat.isCompatible) {
      toast.error(`Incompatible Module`, {
        description: compat.restriction || `${item.name} cannot be fitted to this chassis.`
      })
      return
    }

    // 1. Slot Type Check (Case Insensitive)
    if (item.slotType) {
      const normalizedItemSlot = item.slotType.toLowerCase().replace(' slot', '').trim()
      const normalizedTargetSlot = slotType.toLowerCase().trim()
      
      if (normalizedItemSlot !== normalizedTargetSlot) {
        toast.error(`Invalid Slot`, {
          description: `${item.name} belongs in a ${item.slotType.toUpperCase()} slot, not ${slotType.toUpperCase()}.`
        })
        return
      }
    }

    // 2. Slot Capacity Check
    const maxSlots = stats?.slots?.[slotType as keyof ShipStats['slots']]?.total || 0
    const currentFitted = (fit.modules || []).filter(m => m.slot === slotType).length
    
    if (currentFitted >= maxSlots) {
      toast.error(`No Slots Available`, {
        description: `This ship only has ${maxSlots} ${slotType.toUpperCase()} slots.`,
      })
      return
    }

    const res = await fetch('/api/fits/mutate', {
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
    const data = await res.json()
    if (!res.ok || !data.stats) {
      toast.error('Fit rejected', {
        description: (data.errors || []).join('; ') || res.statusText,
      })
      return
    }
    setFit((prev) => ({
      ...prev,
      modules: data.modules,
      drones: data.drones,
      cargo: data.cargo,
    }))
    setStats(data.stats)
    if (data.success) {
      toast.success(`Module fitted to ${slotType.toUpperCase()} slot ${slotIndex + 1}`)
    } else {
      toast.error('Invalid fit', { description: (data.errors || []).join('; ') })
    }
  }

  const handleChargeSelect = async (charge: {
    id?: number
    typeId?: number
    name?: string
  } | null) => {
    if (!selectedModuleForCharge || !fit.shipId) return

    const res = await fetch('/api/fits/mutate', {
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
    const data = await res.json()
    setChargeModalOpen(false)
    if (!res.ok || !data.stats) {
      toast.error('Charge rejected', {
        description: (data.errors || []).join('; ') || res.statusText,
      })
      return
    }
    setFit((prev) => ({
      ...prev,
      modules: data.modules,
      drones: data.drones,
      cargo: data.cargo,
    }))
    setStats(data.stats)
    if (data.success) {
      toast.success(charge ? `Loaded ${charge.name}` : 'Ammo cleared')
    } else {
      toast.error('Invalid charge', { description: (data.errors || []).join('; ') })
    }
  }

  const handleSave = async () => {
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
        body: JSON.stringify(fit)
      })
      
      if (!res.ok) throw new Error('Failed to save fit')
      
      const savedFit = await res.json()
      toast.success('Fit saved to hull archives')
      if (!id) router.push(`/dashboard/fits/editor?id=${savedFit.id}`)
    } catch (err) {
      toast.error('Encryption failed - database rejected fit entry')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-120px)] bg-zinc-950 gap-6">
        <div className="relative">
          <div className="w-24 h-24 border-2 border-blue-500/20 rounded-full animate-[spin_3s_linear_infinite]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Cpu className="w-8 h-8 text-blue-500 animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <h2 className="text-xl font-black italic tracking-tighter text-white uppercase font-accent">Synchronizing_Chassis...</h2>
          <div className="flex gap-1">
            {[0, 1, 2].map(i => (
              <div key={i} className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-zinc-950 overflow-hidden font-sans select-none">
      
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl z-30">
        <div className="flex items-center gap-6">
          <Link href="/dashboard/fits">
            <Button variant="ghost" size="sm" className="hover:bg-white/5 group px-3 h-9 transition-all active:scale-95">
              <ArrowLeft className="w-4 h-4 mr-2 text-zinc-400 group-hover:text-white transition-colors" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-white transition-colors">TERMINATE_LINK</span>
            </Button>
          </Link>
          <div className="w-px h-6 bg-white/10" />
          <div className="flex flex-col">
            <Input 
              value={fit.name}
              onChange={e => setFit(p => ({ ...p, name: e.target.value }))}
              className="bg-transparent border-none text-lg font-black tracking-tighter text-white h-auto p-0 focus-visible:ring-0 w-64 uppercase italic font-accent"
              placeholder="FIT_IDENTIFIER"
            />
            <div className="flex items-center gap-2 -mt-0.5">
              <Badge variant="outline" className="bg-blue-500/10 border-blue-500/20 text-[8px] font-black py-0 px-2 h-4 text-blue-400 uppercase tracking-widest cursor-pointer hover:bg-blue-500/20 transition-all" onClick={() => setShipSelectorOpen(true)}>
                {fit.ship || 'SELECT_CHASSIS'}
              </Badge>
              <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-widest font-mono">STATUS: STABLE_SYNC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-black/40 rounded-xl p-1 border border-white/5 backdrop-blur-md shadow-inner">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setImportOpen(true)}
              className="h-8 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              <Import className="w-3 h-3 mr-2 text-blue-400" />
              IMPORT_EFT
            </Button>
            <div className="w-px h-4 bg-white/10" />
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => {
                setFit(p => ({ ...p, visibility: p.visibility === 'PUBLIC' ? 'PROTECTED' : 'PUBLIC' }))
                toast.info(`Visibility set to ${fit.visibility === 'PUBLIC' ? 'PROTECTED' : 'PUBLIC'}`)
              }}
              className="h-8 px-4 text-[9px] font-black uppercase tracking-widest text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
            >
              {fit.visibility === 'PUBLIC' ? <Globe className="w-3 h-3 mr-2 text-green-400" /> : <Lock className="w-3 h-3 mr-2 text-orange-400" />}
              {fit.visibility}
            </Button>
          </div>

          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white font-black italic tracking-tighter px-10 h-10 transition-all active:scale-95 shadow-2xl shadow-blue-500/40 uppercase font-accent">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            {saving ? 'COMPILING...' : 'COMMIT_CHANGES'}
          </Button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden h-full relative">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px] z-0" />

        <aside className="w-80 border-r border-white/5 flex flex-col flex-shrink-0 h-full bg-black/20 backdrop-blur-md z-10">
          <div className="flex-1 overflow-y-auto h-full custom-scrollbar">
            <ModuleBrowserPanel 
              onModuleSelect={handleItemFit}
              slots={{
                high: stats?.slots?.high?.total || 0,
                med: stats?.slots?.med?.total || 0,
                low: stats?.slots?.low?.total || 0,
                rig: stats?.slots?.rig?.total || 0
              }}
              shipInfo={{
                id: fit.shipId || 0,
                name: fit.ship || '',
                groupId: stats?.groupId || 0,
                groupName: (stats as any)?.groupName || '',
                rigSize: stats?.rigSize
              }}
              externalCompatibilityMap={compatibilityMap}
              defaultCollapsed={false}
            />
          </div>
        </aside>

        <section className="flex-1 flex flex-col items-center justify-center relative overflow-hidden min-w-0 z-0">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 blur-[160px] rounded-full animate-pulse" />
            <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] bg-purple-500/5 blur-[100px] rounded-full" />
          </div>

          <div className="z-10 flex flex-col items-center flex-shrink-0 mb-12">
            <CircularSlotVisualizer 
              shipId={fit.shipId || 0}
              shipName={fit.ship || 'Select Ship'}
              slots={{
                high: stats?.slots?.high?.total || 0,
                med: stats?.slots?.med?.total || 0,
                low: stats?.slots?.low?.total || 0,
                rig: stats?.slots?.rig?.total || 0
              }}
              fittedModules={fit.modules || []}
              cpuUsed={stats?.cpu?.used || 0}
              cpuTotal={stats?.cpu?.total || 0}
              powerUsed={stats?.power?.used || 0}
              powerTotal={stats?.power?.total || 0}
              capacitorStable={stats?.capacitor?.stable !== false}
              capacitorPercent={stats?.capacitor?.percent || 100}
              calculating={calculating}
              size={540}
              slotHistory={stats?.slotHistory}
              slotErrors={stats?.validation?.slotErrors}
              onModuleRemove={(slotType, slotIndex) => {
                setFit(prev => {
                  const modules = prev.modules || []
                  const targetModule = modules.find(m => {
                    const mSlot = m.slot === 'med' ? 'med' : m.slot
                    return mSlot === slotType && m.slotIndex === slotIndex
                  })
                  
                  if (targetModule) {
                    return {
                      ...prev,
                      modules: modules.filter(m => m !== targetModule)
                    }
                  }
                  return prev
                })
              }}
              onModuleAdd={handleModuleAdd}
              onModuleRightClick={handleModuleRightClick}
              onModuleDrop={handleModuleDrop}
            />

            <div className="mt-20 flex flex-col items-center gap-4 relative z-20 w-full max-w-sm">
              <div className="flex gap-2 w-full bg-black/40 p-1 rounded-xl border border-white/5 backdrop-blur-md">
                <Input 
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTag()}
                  placeholder="ADD_SYSTEM_TAG..."
                  className="h-9 bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-center placeholder:text-zinc-700 focus-visible:ring-0"
                />
                <Button onClick={addTag} variant="ghost" size="sm" className="h-9 w-9 p-0 hover:bg-blue-500/10 hover:text-blue-400">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 justify-center">
                <AnimatePresence>
                  {fit.tags?.map(tag => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                    >
                      <Badge className="bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/20 text-[9px] font-black py-1 px-3 group h-7 cursor-default uppercase tracking-widest text-blue-400/70 transition-all hover:text-blue-400">
                        {tag} 
                        <button 
                          onClick={() => removeTag(tag)}
                          className="ml-2 text-zinc-600 hover:text-red-500 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-8 py-3 bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 flex justify-center items-center gap-10 text-[10px] text-zinc-500 font-mono tracking-widest z-20 shadow-2xl">
            <div className="flex items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="group-hover:text-blue-400 transition-colors">MODULES:</span>
              <span className="text-white font-black">{(fit.modules?.length || 0).toString().padStart(2, '0')}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="group-hover:text-green-400 transition-colors">DRONES:</span>
              <span className="text-white font-black">{(fit.drones?.length || 0).toString().padStart(2, '0')}</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2 group cursor-default">
              <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
              <span className="group-hover:text-orange-400 transition-colors">CARGO:</span>
              <span className="text-white font-black">{(fit.cargo?.length || 0).toString().padStart(2, '0')}</span>
            </div>
          </div>
        </section>

        <aside className="w-96 border-l border-white/5 bg-black/40 backdrop-blur-md flex flex-col flex-shrink-0 h-full z-10 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
          <div className="flex-1 overflow-y-auto h-full custom-scrollbar">
            <ShipAttributesPanel 
              stats={stats}
              shipName={fit.ship || 'No Ship'}
              shipId={fit.shipId || 0}
              calculating={calculating}
              moduleCount={fit.modules?.length || 0}
            />
          </div>
        </aside>
      </main>

      <ShipSelector 
        open={shipSelectorOpen} 
        onOpenChange={setShipSelectorOpen} 
        onSelect={handleShipSelect} 
      />

      <Dialog open={chargeModalOpen} onOpenChange={setChargeModalOpen}>
        <DialogContent className="bg-zinc-950 border-white/10 max-w-md p-0 gap-0 overflow-hidden backdrop-blur-3xl">
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
                <Zap className="w-4 h-4 text-orange-400" />
              </div>
              <div className="flex flex-col">
                <DialogTitle className="text-sm font-black text-white uppercase italic tracking-tighter">
                  {selectedModuleForCharge?.module.name || 'Select Charge'}
                </DialogTitle>
                <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-widest font-mono">Loading_Ordnance_Data...</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setChargeModalOpen(false)}
              className="h-8 w-8 p-0 text-zinc-500 hover:text-white hover:bg-white/5"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
          <div className="max-h-[500px] overflow-y-auto custom-scrollbar p-2">
            {selectedModuleForCharge && (
              <ChargeSelector
                moduleId={Number(selectedModuleForCharge.module.typeId || selectedModuleForCharge.module.id)}
                moduleName={selectedModuleForCharge.module.name || ''}
                currentCharge={selectedModuleForCharge.module.charge}
                onSelect={handleChargeSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}

export default function FitsEditorV1() {
  return (
    <Suspense fallback={
      <div className="flex h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <FitEditorContent />
    </Suspense>
  )
}
