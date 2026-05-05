'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { formatISK } from '@/lib/utils'
import { useActivityStore } from '@/lib/stores/activity-store'
import { Button } from '@/components/ui/button'
import { 
  Zap, 
  Timer, 
  Layers, 
  Package, 
  Trophy, 
  Skull,
  Plus,
  History,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Square
} from 'lucide-react'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { AbyssalLootModal, ConfirmEndModal } from '../modals'
import { getActivityColors } from '@/lib/constants/activity-colors'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { cn } from '@/lib/utils'

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

export function AbyssalActivityContent({ 
  activity, 
  onSync, 
  isSyncing, 
  syncStatus,
  displayMode = 'compact',
  onEnd,
  isPaused,
  onTogglePause
}: AbyssalActivityContentProps) {
  const { t } = useTranslations()
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [abyssalTimeLeft, setAbyssalTimeLeft] = useState('20:00')
  const [isCriticalTime, setIsCriticalTime] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<string | null>(null)
  const [currentSolarSystemId, setCurrentSolarSystemId] = useState<number>(0)
  const [isPollingLocation, setIsPollingLocation] = useState(false)
  const [lastCheckTime, setLastCheckTime] = useState<number | null>(null)
  const [isPending, setIsPending] = useState(false)


  const characterId = useMemo(() => activity.participants?.[0]?.characterId, [activity.participants])

  const colors = getActivityColors('abyssal')

  // Runs Logic
  const runs = useMemo(() => activity.data?.runs || [], [activity.data?.runs])
  const activeRun = useMemo(() => runs.find((r: any) => r.status === 'active'), [runs])

  const updateActivityData = useCallback((updatedData: any) => {
    useActivityStore.getState().updateActivity(activity.id, { data: updatedData })
    fetch(`/api/activities/${activity.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: updatedData })
    })
  }, [activity.id])

  const handleStartRun = useCallback(() => {
    const newRun = {
      id: `run-${Date.now()}`,
      startTime: new Date().toISOString(),
      status: 'active',
      roomsCompleted: 0,
      lootValue: 0,
      tier: activity.data?.tier || 'T0',
      weather: activity.data?.weather || 'None'
    }

    const updatedData = {
      ...activity.data,
      runs: [...runs, newRun]
    }

    updateActivityData(updatedData)
  }, [activity.data, runs, updateActivityData])

  const handleEndRun = useCallback((status: 'success' | 'death') => {
    if (!activeRun) return

    const updatedRuns = runs.map((r: any) => 
      r.id === activeRun.id 
        ? { ...r, status, endTime: new Date().toISOString() } 
        : r
    )

    const updatedData = {
      ...activity.data,
      runs: updatedRuns
    }

    updateActivityData(updatedData)
  }, [activeRun, activity.data, runs, updateActivityData])

  const handleLootSave = useCallback(async (payload: any) => {
    const { lootItems, consumedItems, netValue, afterCargoState: cargoState } = payload
    const timestamp = new Date().toISOString()
    
    const newLog = {
      refId: `abyssal-loot-${Date.now()}`,
      date: timestamp,
      amount: netValue, // Use net profit
      type: 'loot',
      charName: t('activity.abyssal.lootRegistration'),
      items: lootItems,
      consumed: consumedItems,
      runId: activeRun?.id || runs.filter((r: any) => r.status === 'success').pop()?.id
    }

    const updatedData = { 
      ...activity.data, 
      lootValue: (activity.data?.lootValue || 0) + netValue,
      logs: [newLog, ...(activity.data?.logs || [])],
      lastCargoState: cargoState,
      runs: activeRun ? runs.map((r: any) => 
        r.id === activeRun.id 
          ? { ...r, lootValue: (r.lootValue || 0) + netValue } 
          : r
      ) : runs
    }

    updateActivityData(updatedData)
  }, [activeRun, activity.data, runs, t, updateActivityData])

  const updateRooms = useCallback((count: number) => {
    if (!activeRun) return
    const updatedRuns = runs.map((r: any) => 
      r.id === activeRun.id ? { ...r, roomsCompleted: count } : r
    )
    updateActivityData({ ...activity.data, runs: updatedRuns })
  }, [activeRun, activity.data, runs, updateActivityData])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Timer logic for active run
  useEffect(() => {
    if (!activeRun) {
      setAbyssalTimeLeft('20:00')
      setIsCriticalTime(false)
      return
    }

    const startTime = new Date(activeRun.startTime).getTime()
    const limit = 20 * 60 * 1000 // 20 minutes

    const updateTimer = () => {
      const now = Date.now()
      const elapsed = now - startTime
      const remaining = Math.max(0, limit - elapsed)
      
      const minutes = Math.floor(remaining / 60000)
      const seconds = Math.floor((remaining % 60000) / 1000)
      
      setAbyssalTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`)
      setIsCriticalTime(minutes < 5 && remaining > 0)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 1000)
    return () => clearInterval(interval)
  }, [activeRun])

  // ESI Location Polling
  useEffect(() => {
    if (!mounted || !characterId || activity.status === 'completed') return
    
    // Respect tracking mode - only poll if automatic
    const trackingMode = activity.data?.trackingMode || 'automatic'
    if (trackingMode === 'manual') {
      // Still fetch location for the indicator, but don't auto-start/end runs
      const fetchLocationOnly = async () => {
        try {
          setIsPollingLocation(true)
          const res = await fetch(`/api/characters/${characterId}/location`)
          if (res.ok) {
            const data = await res.json()
            setCurrentLocation(data.location || '')
            setLastCheckTime(Date.now())
          }
        } catch (error) {
          console.error('Location check error:', error)
        } finally {
          setIsPollingLocation(false)
        }
      }
      fetchLocationOnly()
      const interval = setInterval(fetchLocationOnly, 30000)
      return () => clearInterval(interval)
    }

    const pollLocation = async () => {
      try {
        setIsPollingLocation(true)
        const res = await fetch(`/api/characters/${characterId}/location`)
        if (res.ok) {
          const data = await res.json()
          const locationName = data.location || ''
          const solarSystemId = data.solar_system_id || 0
          setCurrentLocation(locationName)
          setCurrentSolarSystemId(solarSystemId)
          setLastCheckTime(Date.now())

          // Detection Logic
          const isInAbyss = 
            locationName.toLowerCase().includes('abyssal') || 
            /^AD\d+$/i.test(locationName) ||
            (solarSystemId >= 32000000 && solarSystemId < 33000000)
          
          if (isInAbyss && !activeRun) {
            handleStartRun()
          } else if (!isInAbyss && activeRun) {
            // Player exited Abyss while a run was active
            handleEndRun('success')
            setLootModalOpen(true)
          }
        }
      } catch (error) {
        console.error('Location polling error:', error)
      } finally {
        setIsPollingLocation(false)
      }
    }

    // Initial check
    pollLocation()

    // Poll every 20 seconds for automatic mode
    const interval = setInterval(pollLocation, 20000)
    return () => clearInterval(interval)
  }, [mounted, characterId, activeRun, activity.status, activity.data?.trackingMode, handleStartRun, handleEndRun])




  const handleManualRunToggle = async () => {
    setIsPending(true)
    try {
      if (activeRun) {
        handleEndRun('success')
        setLootModalOpen(true)
      } else {
        handleStartRun()
      }
    } finally {
      setIsPending(false)
    }
  }

  if (!mounted) return null

  const totalLootValue = activity.data?.lootValue || 0
  const successfulRuns = runs.filter((r: any) => r.status === 'success').length

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {/* Active Timer */}
        <div className={`bg-gradient-to-br border rounded-xl p-3 relative overflow-hidden transition-all duration-500 ${
          !activeRun ? "from-zinc-500/5 to-transparent border-zinc-500/10 opacity-50" :
          isCriticalTime 
            ? "from-red-500/20 to-red-500/5 border-red-500/40 shadow-[0_0_15px_rgba(239,68,68,0.1)]" 
            : "from-purple-500/10 to-purple-500/5 border-purple-500/20"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <p className={`text-[8px] uppercase font-black tracking-wider ${isCriticalTime ? "text-red-400" : "text-purple-400/70"}`}>
              {t('activity.abyssal.activeRun')}
            </p>
            <Timer className={`h-3 w-3 ${isCriticalTime ? "text-red-400 animate-pulse" : "text-purple-400"}`} />
          </div>
          <p className={`text-xl font-black font-mono tracking-tighter ${isCriticalTime ? "text-red-400" : "text-white"}`}>
            {abyssalTimeLeft}
          </p>
          
          {/* Location Indicator */}
          <div className="absolute bottom-1 right-2 flex items-center gap-1">
            <div className={`h-1 w-1 rounded-full ${isPollingLocation ? "bg-blue-400 animate-pulse" : (
              (currentLocation?.toLowerCase().includes('abyssal') || 
               (currentLocation && /^AD\d+$/i.test(currentLocation)) ||
               (currentSolarSystemId >= 32000000 && currentSolarSystemId < 33000000)
              ) ? "bg-emerald-400" : "bg-zinc-600"
            )}`} />
            <span className="text-[6px] text-zinc-500 font-bold uppercase truncate max-w-[60px]">
              {currentLocation || t('activity.abyssal.detectingLocation')}
            </span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[8px] text-emerald-400/70 uppercase font-black tracking-wider">{t('activity.abyssal.lootValue')}</p>
            <Package className="h-3 w-3 text-emerald-400" />
          </div>
          <p className="text-sm font-black text-white font-mono tracking-tight">
            {formatISK(totalLootValue)}
          </p>
        </div>

        {/* Runs Completed */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-indigo-500/5 border border-indigo-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[8px] text-indigo-400/70 uppercase font-black tracking-wider">{t('activity.abyssal.runsCompleted')}</p>
            <Trophy className="h-3 w-3 text-indigo-400" />
          </div>
          <p className="text-sm font-black text-white tracking-tight">
            {successfulRuns} / {runs.length}
          </p>
        </div>

        {/* Tier/Weather Fallback */}
        <div className="bg-gradient-to-br from-fuchsia-500/10 to-fuchsia-500/5 border border-fuchsia-500/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[8px] text-fuchsia-400/70 uppercase font-black tracking-wider">{t('activity.abyssal.configuration')}</p>
            <Zap className="h-3 w-3 text-fuchsia-400" />
          </div>
          <p className="text-xs font-black text-white truncate uppercase tracking-tight">
            {activeRun?.tier || activity.data?.tier || 'T0'} <span className="text-zinc-500 mx-1">•</span> {activeRun?.weather || activity.data?.weather || 'None'}
          </p>
        </div>
      </div>

      {/* Manual Run Control (Only when in manual mode) */}
      {activity.data?.trackingMode === 'manual' && (
        <Button 
          onClick={handleManualRunToggle}
          disabled={isPending}
          className={cn(
            "w-full h-12 uppercase font-black tracking-tighter text-xs transition-all duration-500 group relative overflow-hidden",
            activeRun 
              ? "bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20" 
              : "bg-eve-accent text-black hover:bg-eve-accent/80 shadow-[0_0_20px_rgba(0,255,255,0.2)]"
          )}
        >
          {activeRun ? (
            <div className="flex items-center justify-center gap-2">
              <Square className="h-4 w-4 fill-current" />
              Terminar Run Manualmente
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <Play className="h-4 w-4 fill-current" />
              Iniciar Nova Run
            </div>
          )}
        </Button>
      )}

      {activeRun ? (
        <div className="bg-zinc-950/40 border border-white/[0.03] rounded-2xl p-4 space-y-4">
           <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-50 animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
                <span className="text-[10px] text-zinc-400 uppercase font-black tracking-widest">{t('activity.abyssal.activeRun')}</span>
              </div>
              <div className="flex gap-1.5">
                {[1, 2, 3].map((r) => (
                  <div 
                    key={r}
                    onClick={() => updateRooms(r)}
                    className={`h-1.5 w-6 rounded-full cursor-pointer transition-all duration-300 ${r <= (activeRun.roomsCompleted || 0) ? "bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]" : "bg-zinc-800"}`}
                  />
                ))}
              </div>
           </div>
           <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => handleEndRun('death')}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[10px] font-black uppercase h-10"
              >
                <Skull className="h-3.5 w-3.5 mr-2" />
                {t('activity.abyssal.reportDeath')}
              </Button>
              <Button 
                onClick={() => handleEndRun('success')}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase h-10"
              >
                <Trophy className="h-3.5 w-3.5 mr-2" />
                {t('activity.abyssal.success')}
              </Button>
           </div>
        </div>
      ) : (
        <Button 
          onClick={handleStartRun}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black uppercase tracking-widest h-12 shadow-[0_0_20px_rgba(147,51,234,0.2)] group"
        >
          <Play className="h-4 w-4 mr-2 fill-current group-hover:scale-110 transition-transform" />
          {t('activity.abyssal.startNewRun')}
        </Button>
      )}

      {/* Expanded View: History & Logs */}
      {displayMode === 'expanded' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Run History */}
          <div className="bg-zinc-950/40 border border-white/[0.03] rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-4 w-4 text-zinc-500" />
              <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.abyssal.runHistory')}</span>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
              {runs.filter((r: any) => r.status !== 'active').reverse().map((run: any, i: number) => (
                <div key={i} className="flex justify-between items-center p-3 bg-zinc-900/40 border border-white/5 rounded-xl group hover:border-white/10 transition-colors">
                  <div className="flex items-center gap-3">
                    {run.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-tight">
                        {run.tier} • {run.weather}
                      </span>
                      <span className="text-[8px] text-zinc-600 font-black">
                        {run.roomsCompleted}/3 Rooms • <FormattedDate date={run.startTime} mode="time" />
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-emerald-400 font-mono font-black">{formatISK(run.lootValue || 0)}</p>
                    {run.endTime && (
                      <div className="flex items-center justify-end gap-1 text-zinc-600">
                        <Clock className="h-2 w-2" />
                        <span className="text-[8px] font-black">
                          {Math.round((new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 60000)}m
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {runs.length === 0 && (
                <div className="py-8 text-center border border-dashed border-zinc-800 rounded-xl">
                  <p className="text-[10px] text-zinc-600 font-black uppercase tracking-widest">No runs recorded</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Loot */}
          <div className="bg-zinc-950/40 border border-white/[0.03] rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-zinc-500" />
                <span className="text-[10px] text-zinc-400 uppercase font-black tracking-wider">{t('activity.abyssal.lootHistory')}</span>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                disabled={!activeRun}
                className="h-8 w-8 rounded-full hover:bg-purple-500/20 text-purple-400"
                onClick={() => setLootModalOpen(true)}
              >
                <Plus className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
               {(activity.data?.logs || []).map((log: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-2.5 bg-zinc-900/40 border border-white/5 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-300 font-bold uppercase tracking-tight">
                        {log.items?.length || 1} {t('activity.abyssal.itemsFound')}
                      </span>
                      <span className="text-[8px] text-zinc-600 font-black">
                        <FormattedDate date={log.date} mode="time" />
                      </span>
                    </div>
                    <span className="text-[11px] text-emerald-400 font-mono font-black">{formatISK(log.amount)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {displayMode === 'compact' && activeRun && (
        <Button 
          variant="ghost" 
          className="w-full bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase h-9"
          onClick={() => setLootModalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-2" />
          {t('activity.abyssal.registerLoot')}
        </Button>
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
        onOpenChange={setLootModalOpen}
        onSave={handleLootSave}
        lastCargoState={activity.data?.lastCargoState}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        onConfirm={() => {
          setConfirmEndOpen(false)
          onEnd?.()
        }}
      />
    </div>
  )
}
