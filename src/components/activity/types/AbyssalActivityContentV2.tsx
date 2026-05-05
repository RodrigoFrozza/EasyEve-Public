'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatISK, cn, formatNumber, formatCurrencyValue } from '@/lib/utils'
import { useActivityStore } from '@/lib/stores/activity-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { AbyssalLootModal, ConfirmEndModal, AbyssalRunDetailModal } from '../modals'
import { 
  BellRing, Clock3, Gauge, MapPin, Play, Square, Timer, Wallet, 
   Info, Trash2, Loader2, ArrowRight, Pencil
} from 'lucide-react'
import { toast } from 'sonner'
import { calculateAbyssalDelta } from '@/lib/parsers/eve-cargo-parser'
import { getMarketAppraisalWithIds } from '@/lib/market'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'

type TrackingMode = 'automatic' | 'manual'

interface AbyssalRun {
  id: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'death'
  registrationStatus?: 'registered' | 'not_registered'
  tier?: string
  weather?: string
  ship?: string
  lootValue?: number
  note?: string
  lootItems?: Array<{ name: string; quantity: number; value?: number }>
  consumedItems?: Array<{ name: string; quantity: number; value?: number }>
  autoFallback?: boolean
  editable?: boolean
  beforeCargoState?: string
  afterCargoState?: string
}

interface AbyssalActivityContentProps {
  activity: any
  onSync: () => void
  isSyncing: boolean
  syncStatus: 'idle' | 'success' | 'error'
  displayMode?: 'compact' | 'expanded'
  onEnd?: () => void
  isPaused?: boolean
  onTogglePause?: () => void
}

export function AbyssalActivityContentV2({
  activity,
  onSync,
  isSyncing,
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause,
}: AbyssalActivityContentProps) {
  const [mounted, setMounted] = useState(false)
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [editingRunId, setEditingRunId] = useState<string | null>(null)

  // Registration Form State
  const [beforeText, setBeforeText] = useState(activity.data?.lastCargoState || '')
  const [afterText, setAfterText] = useState('')
  const [tier, setTier] = useState(activity.data?.lastRunDefaults?.tier || 'T6 (Cataclysmic)')
  const [weather, setWeather] = useState(activity.data?.lastRunDefaults?.weather || 'Electrical')
  const [ship, setShip] = useState(activity.data?.lastRunDefaults?.ship || 'Undefined')
  const [preview, setPreview] = useState<{ loot: any[], consumed: any[], netValue: number } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isBeforeCargoEditable, setIsBeforeCargoEditable] = useState(false)

  const [timeLeft, setTimeLeft] = useState('20:00')
  const [currentLocation, setCurrentLocation] = useState<string>('')
  const [currentSolarSystemId, setCurrentSolarSystemId] = useState<number>(0)
  const [isPollingLocation, setIsPollingLocation] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [localIsSyncing, setLocalIsSyncing] = useState(false)

  const characterId = useMemo(() => activity.participants?.[0]?.characterId, [activity.participants])
  const characterName = useMemo(() => activity.participants?.[0]?.characterName || 'Pilot', [activity.participants])
  const runs = useMemo<AbyssalRun[]>(() => activity.data?.runs || [], [activity.data?.runs])
  const trackingMode = (activity.data?.trackingMode || 'automatic') as TrackingMode

  const activeRun = useMemo(() => runs.find((run) => run.status === 'active'), [runs])

  // Initialize form from last session if available
  useEffect(() => {
    if (activity.data?.lastSession && !editingRunId) {
      const session = activity.data.lastSession
      setTier(session.tier || activity.data?.lastRunDefaults?.tier || 'T6 (Cataclysmic)')
      setWeather(session.weather || activity.data?.lastRunDefaults?.weather || 'Electrical')
      setShip(session.ship || activity.data?.lastRunDefaults?.ship || 'Undefined')
    }
  }, [activity.data?.lastSession, activity.data?.lastRunDefaults, editingRunId])

  // Calculation Logic
  // Update beforeText if initial cargo state is provided from activity launch (first run)
  useEffect(() => {
    if (runs.length === 0 && !beforeText && activity.data?.lastCargoState) {
      setBeforeText(activity.data.lastCargoState)
    }
  }, [activity.data?.lastCargoState, runs.length, beforeText])

  const handleCalculate = useCallback(async () => {
    if (!afterText.trim()) {
      setPreview(null)
      return
    }
    setIsCalculating(true)
    
    try {
      const { loot, consumed } = calculateAbyssalDelta(beforeText, afterText)
      const allNames = Array.from(new Set([...loot.map(i => i.name), ...consumed.map(i => i.name)]))
      const priceData = await getMarketAppraisalWithIds(allNames)
      
      let totalLootValue = 0
      const lootWithPrices = loot.map(item => {
        const itemInfo = priceData[item.name.toLowerCase()]
        const price = itemInfo?.price || 0
        const id = itemInfo?.id
        const value = price * item.quantity
        totalLootValue += value
        return { ...item, price, value, id }
      })
      
      let totalConsumedValue = 0
      const consumedWithPrices = consumed.map(item => {
        const itemInfo = priceData[item.name.toLowerCase()]
        const price = itemInfo?.price || 0
        const id = itemInfo?.id
        const value = price * item.quantity
        totalConsumedValue += value
        return { ...item, price, value, id }
      })
      
      setPreview({
        loot: lootWithPrices,
        consumed: consumedWithPrices,
        netValue: totalLootValue - totalConsumedValue
      })
    } catch (error) {
      console.error('Calculation error:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [afterText, beforeText])

  useEffect(() => {
    const timer = setTimeout(() => {
      handleCalculate()
    }, 500)
    return () => clearTimeout(timer)
  }, [afterText, beforeText, handleCalculate])

  const persistData = useCallback(
    async (nextData: any) => {
      setLocalIsSyncing(true)
      useActivityStore.getState().updateActivity(activity.id, { data: nextData })
      
      try {
        const response = await fetch(`/api/activities/${activity.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: nextData }),
        })
        
        if (!response.ok) {
          throw new Error(`Sync failed: ${response.status}`)
        }
      } catch (err) {
        console.error('[AbyssalSync] Error:', err)
        toast.error('Sync Error', {
          description: 'Failed to save changes to cloud. Local state preserved.'
        })
      } finally {
        setLocalIsSyncing(false)
      }
    },
    [activity.id]
  )

  const startRun = useCallback(() => {
    if (activeRun) return

    const defaults = activity.data?.lastRunDefaults || {}
    const initialCargo = activity.data?.lastCargoState || ''

    const newRun: AbyssalRun = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      status: 'active',
      tier: defaults.tier || 'T6 (Cataclysmic)',
      weather: defaults.weather || 'Electrical',
      ship: defaults.ship || 'Undefined',
      lootValue: 0,
      beforeCargoState: initialCargo,
    }

    persistData({
      ...activity.data,
      trackingMode,
      runs: [...runs, newRun],
    })
  }, [activeRun, activity.data, persistData, runs, trackingMode])

  const handleDeleteRun = useCallback((runId: string) => {
    const updatedRuns = runs.filter(r => r.id !== runId)
    const totalLootValue = updatedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)

    persistData({
      ...activity.data,
      runs: updatedRuns,
      lootValue: totalLootValue,
      logs: (activity.data?.logs || []).filter((l: any) => l.runId !== runId)
    })

    toast.info('Run Deleted', {
      description: 'Historical run has been removed.'
    })
  }, [activity.data, persistData, runs])

  const endActiveRun = useCallback(() => {
    if (!activeRun) return

    // Instead of keeping it in runs, we move it to lastSession for registration
    const remainingRuns = runs.filter(r => r.id !== activeRun.id)

    persistData({
      ...activity.data,
      runs: remainingRuns,
      lastSession: {
        startTime: activeRun.startTime,
        endTime: new Date().toISOString(),
        tier: activeRun.tier,
        weather: activeRun.weather,
        ship: activeRun.ship,
      }
    })
  }, [activeRun, activity.data, persistData, runs])

  const handleDeath = useCallback(() => {
    if (!activeRun) return

    const deadRuns = runs.map((run) =>
      run.id === activeRun.id
        ? {
            ...run,
            status: 'death' as const,
            endTime: new Date().toISOString(),
            registrationStatus: 'not_registered' as const,
            lootValue: 0,
            note: 'Player died in run',
          }
        : run
    )

    persistData({
      ...activity.data,
      runs: deadRuns,
    })

    toast.error('Run Recorded as Death', {
      description: 'The loss has been logged for global statistics.'
    })
  }, [activeRun, activity.data, persistData, runs])

  const saveAbyssalRegistration = useCallback(
    (payload: {
      lootItems: any[]
      consumedItems: any[]
      netValue: number
      beforeCargoState: string
      afterCargoState: string
      tier: string
      weather: string
      ship: string
    }) => {
      // Find the run being edited, or create a new one from lastSession or scratch
      let targetRunId = editingRunId
      let startTime = activity.data?.lastSession?.startTime || new Date(Date.now() - 20 * 60 * 1000).toISOString()
      let endTime = activity.data?.lastSession?.endTime || new Date().toISOString()

      const newRun: AbyssalRun = {
        id: targetRunId || crypto.randomUUID(),
        startTime,
        endTime,
        status: 'completed',
        tier: payload.tier,
        weather: payload.weather,
        ship: payload.ship,
        lootItems: payload.lootItems,
        consumedItems: payload.consumedItems,
        lootValue: payload.netValue,
        registrationStatus: 'registered' as const,
        beforeCargoState: payload.beforeCargoState,
        afterCargoState: payload.afterCargoState,
        editable: true,
      }

      let updatedRuns: AbyssalRun[] = []
      if (editingRunId) {
        updatedRuns = runs.map(r => r.id === editingRunId ? newRun : r)
      } else {
        updatedRuns = [...runs, newRun]
      }

      const totalLootValue = updatedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)

      persistData({
        ...activity.data,
        runs: updatedRuns,
        lastSession: null, // Clear the session after registration
        logs: [
          {
            refId: crypto.randomUUID(),
            date: new Date().toISOString(),
            amount: payload.netValue,
            type: 'loot',
            charName: characterName,
            items: payload.lootItems,
            consumed: payload.consumedItems,
            runId: newRun.id,
          },
          ...(activity.data?.logs || []),
        ],
        lootValue: totalLootValue,
        lastCargoState: payload.afterCargoState,
        lastRunDefaults: {
          tier: payload.tier,
          weather: payload.weather,
          ship: payload.ship,
        },
      })
      
      setEditingRunId(null)
      // Reset local states for the next run - VITAL: afterText must be cleared and beforeText promoted
      setBeforeText(payload.afterCargoState)
      setAfterText('')
      setPreview(null)
      
      toast.success('Abyssal Registration', {
        description: 'Loot registered and cargo states updated.'
      })
    },
    [activity.data, characterName, persistData, runs, editingRunId]
  )

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!activeRun) {
      setTimeLeft('20:00')
      return
    }

    const runStart = new Date(activeRun.startTime).getTime()
    const limit = 20 * 60 * 1000
    const timer = setInterval(() => {
      const remaining = Math.max(0, limit - (Date.now() - runStart))
      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
    }, 1000)

    return () => clearInterval(timer)
  }, [activeRun])

  useEffect(() => {
    if (!mounted || !characterId || activity.status === 'completed') return

    let pollTimer: NodeJS.Timeout
    let currentDelay = 15000 // Start with 15s

    const poll = async () => {
      setIsPollingLocation(true)
      try {
        const response = await fetch(`/api/characters/${characterId}/location`)
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMsg = errorData.error || `Error ${response.status}`
          setLocationError(errorMsg)
          
          // Increase delay on error (up to 5 minutes)
          currentDelay = Math.min(currentDelay * 2, 300000)
          
          // If rate limited, wait at least 30s
          if (errorMsg.toLowerCase().includes('limit reached')) {
            currentDelay = Math.max(currentDelay, 60000)
          }
          
          pollTimer = setTimeout(poll, currentDelay)
          return
        }

        const payload = await response.json()
        const location = payload.location || ''
        const solarSystemId = payload.solar_system_id || 0
        setCurrentLocation(location)
        setCurrentSolarSystemId(solarSystemId)
        setLocationError(null)
        
        // Reset delay on success
        currentDelay = 15000

        const insideAbyss = 
          location.toLowerCase().includes('abyssal') || 
          /^AD\d+$/i.test(location) || 
          (solarSystemId >= 32000000 && solarSystemId < 33000000)

        if (trackingMode === 'automatic') {
          if (insideAbyss && !activeRun) startRun()
          if (!insideAbyss && activeRun) endActiveRun()
        }
        
        pollTimer = setTimeout(poll, currentDelay)
      } catch (err) {
        console.error('[LocationPoll] Error:', err)
        setLocationError('Connection failed')
        currentDelay = Math.min(currentDelay * 2, 300000)
        pollTimer = setTimeout(poll, currentDelay)
      } finally {
        setIsPollingLocation(false)
      }
    }

    poll()

    return () => {
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [mounted, characterId, activity.status, trackingMode, activeRun, startRun, endActiveRun])

  if (!mounted) return null

  const completedRuns = runs.filter((run) => run.status !== 'active')
  const totalFilaments = completedRuns.length
  const totalIsk = completedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)
  const bestRunValue = completedRuns.reduce((best, run) => Math.max(best, run.lootValue || 0), 0)
  const totalDurationMs = completedRuns.reduce((sum, run) => {
    const start = new Date(run.startTime).getTime()
    const end = run.endTime ? new Date(run.endTime).getTime() : start + (20 * 60 * 1000)
    return sum + (end - start)
  }, 0)
  const iskPerHour = totalDurationMs > 0 ? totalIsk / (totalDurationMs / 3600000) : 0
  const isInsideAbyss = 
    currentLocation.toLowerCase().includes('abyssal') || 
    /^AD\d+$/i.test(currentLocation) ||
    (currentSolarSystemId >= 32000000 && currentSolarSystemId < 33000000)

  const isModuleSyncing = isSyncing || localIsSyncing

  const metricCardShell = "bg-zinc-900/40 border border-white/5 rounded-xl p-3 flex flex-col gap-1 hover:bg-zinc-900/60 transition-colors"

  return (
    <div className="space-y-4">
      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
            {(activity.participants || []).map((participant: any) => (
              <Tooltip key={participant.characterId}>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 ring-2 ring-zinc-950 transition-transform hover:scale-110 hover:z-10 ring-fuchsia-500/40">
                    <AvatarImage src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`} />
                    <AvatarFallback>{participant.characterName?.[0] || 'A'}</AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="bottom">{participant.characterName}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="h-6 w-px bg-white/10 mx-1 hidden sm:block" />
         </div>

        <div className="inline-flex rounded-xl bg-zinc-900/80 border border-zinc-700/50 p-1 gap-1">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-7 px-2 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all ${trackingMode === 'automatic' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-400'}`}
            onClick={() => persistData({ ...activity.data, trackingMode: 'automatic' as TrackingMode })}
          >
            Auto
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={`h-7 px-2 text-[10px] uppercase font-black tracking-wider rounded-lg transition-all ${trackingMode === 'manual' ? 'bg-fuchsia-500/20 text-fuchsia-300' : 'text-zinc-500 hover:text-zinc-400'}`}
            onClick={() => persistData({ ...activity.data, trackingMode: 'manual' as TrackingMode })}
          >
            Manual
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <ActivityStatDisplay
          label="Filaments"
          value={totalFilaments}
          subValue="runs"
          size="compact"
          valueClassName="text-white"
          icon={<Gauge className="h-3 w-3 text-fuchsia-300" />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label="Total ISK"
          value={formatCurrencyValue(totalIsk)}
          subValue="isk"
          size="compact"
          valueClassName="text-white"
          icon={<Wallet className="h-3 w-3 text-fuchsia-300" />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label="Best Run"
          value={formatCurrencyValue(bestRunValue)}
          subValue="isk"
          size="compact"
          valueClassName="text-white"
          icon={<BellRing className="h-3 w-3 text-fuchsia-300" />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label="ISK/h"
          value={formatCurrencyValue(iskPerHour)}
          subValue="isk/h"
          size="compact"
          valueClassName="text-white"
          icon={<Clock3 className="h-3 w-3 text-fuchsia-300" />}
          className={cn(metricCardShell, 'cursor-pointer ring-1 ring-fuchsia-500/25 hover:ring-fuchsia-400/50 transition-all')}
        />
      </div>

      <div className="rounded-xl border border-fuchsia-500/30 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/10 to-red-500/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-300">
            <Timer className="h-4 w-4 text-fuchsia-300" />
            <span className="text-xs uppercase tracking-wider">Abyssal Timer</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-black font-mono text-white leading-none">{timeLeft}</span>
            {activeRun && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeath}
                className="mt-2 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-black uppercase tracking-widest rounded-lg flex items-center gap-2 px-3 shadow-lg shadow-red-500/10"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                Record Death
              </Button>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <MapPin className={`h-3.5 w-3.5 ${isInsideAbyss ? 'text-red-400' : 'text-emerald-400'}`} />
          <span className={isInsideAbyss ? 'text-red-400' : 'text-emerald-400'}>
            Location: {
              currentLocation 
                ? ((currentLocation.toLowerCase().includes('abyssal deadspace') || /^[AIRCNT]D\d+$/i.test(currentLocation)) ? `Abyssal Deadspace (${currentLocation})` : currentLocation)
                : (isPollingLocation ? 'Detecting...' : (locationError ? `Error: ${locationError}` : 'Unknown'))
            }
          </span>
        </div>

        {/* Embedded Registration Form */}
        {!isInsideAbyss && (
          <div className="mt-4 pt-4 border-t border-fuchsia-500/20 space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Tier</label>
                <Select 
                  value={tier} 
                  onValueChange={(val) => {
                    setTier(val)
                    persistData({
                      ...activity.data,
                      lastRunDefaults: { ...activity.data?.lastRunDefaults, tier: val }
                    })
                  }}
                >
                  <SelectTrigger className="h-8 bg-zinc-950/50 border-zinc-800 text-zinc-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ABYSSAL_TIERS.map((tValue: any) => (
                      <SelectItem key={tValue.label} value={tValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={tValue.iconPath} />
                            <AvatarFallback className="text-[8px]">T</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{tValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Weather</label>
                <Select 
                  value={weather} 
                  onValueChange={(val) => {
                    setWeather(val)
                    persistData({
                      ...activity.data,
                      lastRunDefaults: { ...activity.data?.lastRunDefaults, weather: val }
                    })
                  }}
                >
                  <SelectTrigger className="h-8 bg-zinc-950/50 border-zinc-800 text-zinc-200 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ABYSSAL_WEATHER.map((wValue: any) => (
                      <SelectItem key={wValue.label} value={wValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={wValue.iconPath} />
                            <AvatarFallback className="text-[8px]">W</AvatarFallback>
                          </Avatar>
                          <span className="text-xs">{wValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] uppercase font-black text-zinc-500 ml-1">Ship</label>
              <Input
                value={ship}
                readOnly
                placeholder="Ship used"
                className="h-8 bg-zinc-950/50 border-zinc-800 text-zinc-200 text-xs opacity-60 cursor-not-allowed"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-500 ml-1 flex items-center justify-between">
                  Before Cargo
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 text-zinc-500 hover:text-fuchsia-300"
                    onClick={() => setIsBeforeCargoEditable(!isBeforeCargoEditable)}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </label>
                <Textarea
                  value={beforeText}
                  onChange={(e) => {
                    const val = e.target.value
                    setBeforeText(val)
                    persistData({ ...activity.data, lastCargoState: val })
                  }}
                  readOnly={!isBeforeCargoEditable}
                  placeholder="Initial inventory..."
                  className={cn(
                    "bg-zinc-950/50 border-zinc-800 text-zinc-300 font-mono text-[10px] h-24 resize-none focus-visible:ring-fuchsia-500/30",
                    !isBeforeCargoEditable && "opacity-60 cursor-not-allowed"
                  )}
                />
                
                {preview && preview.loot.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] uppercase font-black text-emerald-400 tracking-wider flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                      Gained Items
                    </p>
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2 max-h-[120px] overflow-y-auto custom-scrollbar space-y-1.5">
                      {preview.loot.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] group">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-4 w-4 rounded-sm shrink-0">
                              <AvatarImage src={`https://images.evetech.net/types/${item.id}/icon?size=32`} />
                              <AvatarFallback className="text-[6px] bg-zinc-800">IT</AvatarFallback>
                            </Avatar>
                            <span className="text-zinc-300 truncate font-medium group-hover:text-white transition-colors">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-500">x{item.quantity}</span>
                            <span className="text-emerald-400 font-mono font-bold">{formatISK(item.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-black text-zinc-500 ml-1 flex items-center justify-between">
                  Next Cargo
                  {isCalculating && <Loader2 className="h-3 w-3 animate-spin text-fuchsia-400" />}
                </label>
                <Textarea
                  value={afterText}
                  onChange={(e) => {
                    const val = e.target.value
                    setAfterText(val)
                  }}
                  placeholder="Paste inventory here..."
                  className="bg-zinc-950/50 border-zinc-800 text-zinc-300 font-mono text-[10px] h-24 resize-none focus-visible:ring-fuchsia-500/30"
                />

                {preview && preview.consumed.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[10px] uppercase font-black text-red-400 tracking-wider flex items-center gap-2">
                      <div className="h-1 w-1 rounded-full bg-red-500" />
                      Used Items
                    </p>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2 max-h-[120px] overflow-y-auto custom-scrollbar space-y-1.5">
                      {preview.consumed.map((item: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-[10px] group">
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-4 w-4 rounded-sm shrink-0">
                              <AvatarImage src={`https://images.evetech.net/types/${item.id}/icon?size=32`} />
                              <AvatarFallback className="text-[6px] bg-zinc-800">IT</AvatarFallback>
                            </Avatar>
                            <span className="text-zinc-300 truncate font-medium group-hover:text-white transition-colors">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-zinc-500">x{item.quantity}</span>
                            <span className="text-red-400 font-mono font-bold">-{formatISK(item.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {preview && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                <div className="bg-gradient-to-r from-purple-500/10 via-zinc-900/50 to-emerald-500/10 border border-white/5 rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <p className="text-[9px] uppercase font-black text-zinc-500 tracking-widest mb-0.5">Net Loot Value</p>
                    <p className={`text-lg font-black font-mono tracking-tighter ${preview.netValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatISK(preview.netValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] uppercase font-black text-zinc-500 tracking-widest mb-0.5">Loot items</p>
                    <p className="text-xs font-bold text-zinc-300">{preview.loot.length} detected</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {trackingMode === 'manual' && (
        <Button
          type="button"
          className={`w-full h-10 font-bold text-xs uppercase ${activeRun ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40' : 'bg-fuchsia-500/20 hover:bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40'}`}
          onClick={() => (activeRun ? endActiveRun() : startRun())}
        >
          {activeRun ? <Square className="h-3.5 w-3.5 mr-2" /> : <Play className="h-3.5 w-3.5 mr-2" />}
          {activeRun ? 'Stop 20m Timer' : 'Start 20m Timer'}
        </Button>
      )}

      <Button
        type="button"
        disabled={
          (trackingMode === 'automatic' && isInsideAbyss) || !afterText.trim() || isCalculating
        }
        className={`w-full h-10 text-xs uppercase font-bold border transition-all ${afterText.trim() && !isInsideAbyss ? 'bg-amber-500/20 border-amber-400/50 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.15)]' : 'bg-zinc-900 border-zinc-700 text-zinc-500'}`}
        onClick={() => {
          saveAbyssalRegistration({
            lootItems: preview?.loot || [],
            consumedItems: preview?.consumed || [],
            netValue: preview?.netValue || 0,
            beforeCargoState: beforeText,
            afterCargoState: afterText,
            tier,
            weather,
            ship,
          })
        }}
      >
        {isInsideAbyss ? 'Active Run - Locking' : 'Register Abyssal'}
      </Button>

      {displayMode === 'expanded' && (
        <div className="space-y-2 rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
          {completedRuns.length === 0 ? (
            <p className="text-xs text-zinc-500">No abyssal history yet.</p>
          ) : (
            completedRuns
              .slice()
              .reverse()
              .map((run) => {
                const durationMin = run.endTime
                  ? Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 60000)
                  : 0
                return (
                  <div 
                    key={run.id} 
                    className="rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3 space-y-1 cursor-pointer hover:bg-zinc-900/60 transition-colors group"
                    onClick={() => {
                      setSelectedRunId(run.id)
                      setDetailModalOpen(true)
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-zinc-200 font-semibold group-hover:text-fuchsia-300 transition-colors">
                        {run.tier || 'Undefined'} · {run.weather || 'Undefined'}
                      </p>
                      <p className={`text-xs font-mono ${run.lootValue && run.lootValue > 0 ? 'text-emerald-300' : 'text-zinc-500'}`}>
                        {formatISK(run.lootValue || 0)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <p>
                          {durationMin}m · {
                            run.status === 'death' ? 'Death' : 'Registered'
                          }
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {run.ship && <p className="text-zinc-600 italic">via {run.ship}</p>}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 text-zinc-700 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteRun(run.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
          )}
        </div>
      )}

      <ActivityCardFooter
        activityType="abyssal"
        mode={displayMode}
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onEnd={() => setConfirmEndOpen(true)}
        onExport={() => {}}
      />

      <AbyssalLootModal
        open={lootModalOpen}
        onOpenChange={(open) => {
          setLootModalOpen(open)
          if (!open) setEditingRunId(null)
        }}
        onSave={saveAbyssalRegistration}
        initialData={{
          beforeText: (() => {
            const targetRun = runs.find(r => r.id === editingRunId)
            if (targetRun?.beforeCargoState) return targetRun.beforeCargoState
            
            return activity.data?.lastCargoState || ''
          })(),
          tier: runs.find(r => r.id === editingRunId)?.tier || activity.data?.lastSession?.tier,
          weather: runs.find(r => r.id === editingRunId)?.weather || activity.data?.lastSession?.weather,
          ship: runs.find(r => r.id === editingRunId)?.ship || activity.data?.lastSession?.ship,
          afterText: runs.find(r => r.id === editingRunId)?.afterCargoState || '',
        }}
        lastCargoState={activity.data?.lastCargoState}
        defaultTier={activity.data?.lastRunDefaults?.tier}
        defaultWeather={activity.data?.lastRunDefaults?.weather}
        defaultShip={activity.data?.lastRunDefaults?.ship}
      />

      <AbyssalRunDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        run={runs.find(r => r.id === selectedRunId) || null}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={() => {
          setConfirmEndOpen(false)
          // If there's an active run, we mark it as completed first to ensure it's recorded
          if (activeRun) {
            const finishedRuns = runs.map((run) =>
              run.id === activeRun.id
                ? {
                    ...run,
                    status: 'completed' as const,
                    endTime: new Date().toISOString(),
                    registrationStatus: 'pending' as const,
                  }
                : run
            )
            persistData({ ...activity.data, runs: finishedRuns })
          }
          onEnd?.()
        }}
      />
    </div>
  )
}
