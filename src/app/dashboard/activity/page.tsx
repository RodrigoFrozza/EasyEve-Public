'use client'

import { useState, useEffect, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from '@/i18n/hooks'
import { ActivityCard } from '@/components/activity/ActivityCard'
import { ActivityHistoryItem } from '@/components/activity/ActivityHistoryItem'
import { ActivityHistoryHeader } from '@/components/activity/ActivityHistoryHeader'
import { ActivityDetailDialog } from '@/components/activity/ActivityDetailDialog'
import { OperationHistoryList } from '@/components/activity/OperationHistoryList'
import { RattingHelpModal } from '@/components/activity/RattingHelpModal'
import { NewActivityHelpTooltip } from '@/components/activity/NewActivityHelpTooltip'
import { ActivityTypeHelpTooltip } from '@/components/activity/ActivityTypeHelpTooltip'
import { ActivityOnboardingTour } from '@/components/activity/ActivityOnboardingTour'
import { MiningSetupValuableOresPreview } from '@/components/activity/MiningSetupValuableOresPreview'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DialogTrigger } from '@/components/ui/dialog'
import { Combobox, StructureCombobox, ContainerCombobox } from '@/components/ui/combobox'
import { 
  Play, 
  Pause, 
  X, 
  Clock, 
  Users, 
  ChevronRight, 
  AlertCircle, 
  CheckCircle2, 
  CheckCircle,
  XCircle,
  Loader2,
  Star,
  Shield,
  Target,
  MapPin,
  UserPlus,
  HelpCircle,
  Trash2,
  RefreshCw,
  Settings,
  Award,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Package,
  Zap,
  TrendingUp,
  Box,
  Lock,
  Gem,
  DollarSign,
} from 'lucide-react'
import { cn, formatISK, formatNumber, isPremium } from '@/lib/utils'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { useActivityStore, type Activity } from '@/lib/stores/activity-store'
import { useSession } from '@/lib/session-client'
import { useShallow } from 'zustand/react/shallow'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ACTIVITY_UI_MAPPING } from '@/lib/constants/activity-ui'
import { 
  ACTIVITY_TYPES, 
  REGIONS, 
  SPACE_TYPES, 
  MINING_TYPES, 
  NPC_FACTIONS, 
  SHIP_SIZES, 
  EXPLORATION_SITE_TYPES, 
  DIFFICULTIES, 
  CRAB_PHASES, 
  DED_LEVELS 
} from '@/lib/constants/activity-data'
import { ActivitySelectContentList } from '@/app/dashboard/activity/activity-select-content-list'
import { AbyssalConfigDialog } from '@/app/dashboard/activity/abyssal-config-dialog'
import { FleetTemplateSelector } from '@/components/activity/FleetTemplateSelector'
import {
  useActivityFitsModules,
  useActivityUrlTypeSync,
  useActivityTrackerLifecycle,
  useOpenAbyssalConfigListener,
  useRattingAnomalies,
} from '@/app/dashboard/activity/use-activity-tracker-hooks'
import { AnomaliesIntelDialog } from '@/components/activity/AnomaliesIntelDialog'
import {
  ACTIVITY_TOUR_LAUNCH_ARM_EVENT,
  ACTIVITY_TOUR_LAUNCH_DISARM_EVENT,
  ACTIVITY_TOUR_START_EVENT,
} from '@/lib/activity-tour/storage'

export default function ActivityTrackerPage() {
  const { t } = useTranslations()
  
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <p className="text-muted-foreground animate-pulse">{t('common.loadingTracker')}</p>
      </div>
    }>
      <ActivityTrackerContent />
    </Suspense>
  )
}

function ActivityTrackerContent() {
  const { t } = useTranslations()
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')?.toLowerCase()
  
  const userAllowedActivities = session?.user?.allowedActivities || ['ratting']
  const userRole = session?.user?.role || 'user'
  
  const {
    activities,
    pagination,
    addActivity,
    updateActivity,
    removeActivity,
    isCharacterBusy,
    fetchFromAPI,
    startPolling,
    stopPolling,
    startRattingAutoSync,
    stopRattingAutoSync,
    startMiningAutoSync,
    stopMiningAutoSync,
  } = useActivityStore(
    useShallow((s) => ({
      activities: s.activities,
      pagination: s.pagination,
      addActivity: s.addActivity,
      updateActivity: s.updateActivity,
      removeActivity: s.removeActivity,
      isCharacterBusy: s.isCharacterBusy,
      fetchFromAPI: s.fetchFromAPI,
      startPolling: s.startPolling,
      stopPolling: s.stopPolling,
      startRattingAutoSync: s.startRattingAutoSync,
      stopRattingAutoSync: s.stopRattingAutoSync,
      startMiningAutoSync: s.startMiningAutoSync,
      stopMiningAutoSync: s.stopMiningAutoSync,
    }))
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [userFits, setUserFits] = useState<any[]>([])
  const [moduleConfigs, setModuleConfigs] = useState<any[]>([])
  const [configActivityId, setConfigActivityId] = useState<string | null>(null)
  const [historyDensity, setHistoryDensity] = useState<'compact' | 'comfortable'>('compact')
  const [historyPageLimit, setHistoryPageLimit] = useState(10)
  const [selectedHistoryActivity, setSelectedHistoryActivity] = useState<any | null>(null)
  const [isLoadingHistoryDetail, setIsLoadingHistoryDetail] = useState(false)
  const [tourCreatedActivityId, setTourCreatedActivityId] = useState<string | null>(null)
  const [isTourLaunchArmed, setIsTourLaunchArmed] = useState(false)
  const [rattingConfigInteractionCount, setRattingConfigInteractionCount] = useState(0)

  useOpenAbyssalConfigListener(setConfigActivityId)
  useActivityFitsModules(setUserFits, setModuleConfigs)

  useEffect(() => {
    const armLaunch = () => setIsTourLaunchArmed(true)
    const disarmLaunch = () => setIsTourLaunchArmed(false)

    window.addEventListener(ACTIVITY_TOUR_LAUNCH_ARM_EVENT, armLaunch)
    window.addEventListener(ACTIVITY_TOUR_LAUNCH_DISARM_EVENT, disarmLaunch)

    return () => {
      window.removeEventListener(ACTIVITY_TOUR_LAUNCH_ARM_EVENT, armLaunch)
      window.removeEventListener(ACTIVITY_TOUR_LAUNCH_DISARM_EVENT, disarmLaunch)
    }
  }, [])

  const [newActivity, setNewActivity] = useState<Partial<Activity>>({
    type: (typeParam as any) || 'mining',
    status: 'active',
    participants: [],
    data: {
      lastCargoState: '',
      totalLootValue: 0,
      logs: [],
      trackingMode: 'automatic',
    },
  })

  const [anomalies, setAnomalies] = useState<any[]>([])
  const [rattingContainerValidation, setRattingContainerValidation] = useState<'idle' | 'valid' | 'invalid' | 'checking' | 'multiple'>('idle')
  const [matchedContainers, setMatchedContainers] = useState<any[]>([])
  const [showAutoLootHelp, setShowAutoLootHelp] = useState(false)

  const rattingPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-ratting-preset-${userId}`
  }, [session?.user?.id])

  const miningPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-mining-preset-${userId}`
  }, [session?.user?.id])

  useActivityUrlTypeSync(typeParam, setNewActivity)
  useActivityTrackerLifecycle({
    typeParam,
    fetchFromAPI,
    startPolling,
    stopPolling,
    startRattingAutoSync,
    stopRattingAutoSync,
    startMiningAutoSync,
    stopMiningAutoSync,
  })
  useRattingAnomalies(newActivity, setAnomalies)

  useEffect(() => {
    const savedDensity = localStorage.getItem('activity-history-density')
    if (savedDensity === 'compact' || savedDensity === 'comfortable') {
      setHistoryDensity(savedDensity)
    }

    const savedLimit = Number(localStorage.getItem('activity-history-page-limit') || '')
    if ([10, 20, 30].includes(savedLimit)) {
      setHistoryPageLimit(savedLimit)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('activity-history-density', historyDensity)
  }, [historyDensity])

  useEffect(() => {
    localStorage.setItem('activity-history-page-limit', String(historyPageLimit))
    void fetchFromAPI(typeParam ?? undefined, 1, historyPageLimit)
  }, [fetchFromAPI, historyPageLimit, typeParam])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'ratting') return
    const rawPreset = localStorage.getItem(rattingPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        space: parsed.space || prev.space,
        data: {
          ...(prev.data || {}),
          npcFaction: parsed.npcFaction || prev.data?.npcFaction,
          siteType: parsed.siteType || prev.data?.siteType,
          siteName: parsed.siteName || prev.data?.siteName,
          autoLootTrackingEnabled: !!parsed.autoLootTrackingEnabled,
          autoLootCharacterId: parsed.autoLootCharacterId || prev.data?.autoLootCharacterId,
          autoLootStructureId: parsed.autoLootStructureId || prev.data?.autoLootStructureId,
          autoLootStructureName: parsed.autoLootStructureName || prev.data?.autoLootStructureName,
          autoLootContainerId: parsed.autoLootContainerId || prev.data?.autoLootContainerId,
          autoLootContainerName: parsed.autoLootContainerName || prev.data?.autoLootContainerName,
        },
        participants: Array.isArray(parsed.participants) ? parsed.participants : prev.participants,
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, rattingPresetStorageKey])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'mining') return
    const rawPreset = localStorage.getItem(miningPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        space: parsed.space || prev.space,
        data: {
          ...(prev.data || {}),
          miningType: parsed.miningType || prev.data?.miningType,
        },
        participants: Array.isArray(parsed.participants) ? parsed.participants : prev.participants,
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, miningPresetStorageKey])

  useEffect(() => {
    if (newActivity.type !== 'ratting') return
    if (!newActivity.data?.autoLootTrackingEnabled) {
      setRattingContainerValidation('idle')
      return
    }
    const characterId = newActivity.data?.autoLootCharacterId
    const structureId = newActivity.data?.autoLootStructureId
    const containerId = newActivity.data?.autoLootContainerId
    
    if (!characterId) {
      setRattingContainerValidation('idle')
      return
    }
    
    if (!structureId) {
      setRattingContainerValidation('idle')
      return
    }
    
    if (!containerId) {
      setRattingContainerValidation('idle')
      return
    }
    
    setRattingContainerValidation('valid')
  }, [newActivity.data?.autoLootTrackingEnabled, newActivity.data?.autoLootCharacterId, newActivity.data?.autoLootStructureId, newActivity.data?.autoLootContainerId, newActivity.type])

  // Auto-set faction for special spaces
  useEffect(() => {
    if (newActivity.type !== 'ratting') return
    if (newActivity.space === 'Wormhole') {
      updateData({ npcFaction: 'Sleepers' })
    } else if (newActivity.space === 'Pochven') {
      updateData({ npcFaction: 'Triglavian' })
    }
  }, [newActivity.space, newActivity.type])

  const hasPremium = isPremium(session?.user?.subscriptionEnd)
  const activeActivities = activities.filter((a) => a.status === 'active')
  const canStartNewActivity = hasPremium || activeActivities.length === 0

  const handleStartActivity = async () => {
    if (!newActivity.type || !newActivity.participants?.length) {
      toast.error('Type and Participants are required')
      return
    }

    if (newActivity.type === 'mining') {
      if (!newActivity.space) {
        toast.error('Security Level / Space is required')
        return
      }
      if (!newActivity.data?.miningType) {
        toast.error('Mining category is required')
        return
      }
    }

    if (newActivity.type === 'ratting') {
      if (!newActivity.space) {
        toast.error('Security Level / Space is required')
        return
      }
      if (!newActivity.data?.npcFaction) {
        toast.error('Hostile Faction is required')
        return
      }
      if (!newActivity.data?.siteName) {
        toast.error('Detected Anomaly is required')
        return
      }
      if (newActivity.data?.autoLootTrackingEnabled) {
        if (!newActivity.data?.autoLootCharacterId) {
          toast.error('Container Owner is required for auto loot')
          return
        }
        if (!newActivity.data?.autoLootContainerName) {
          toast.error('Container Name is required for auto loot')
          return
        }
      }
    }

    try {
      // O backend agora coloca campos extras automaticamente em 'data'
      const payload = {
        type: newActivity.type,
        typeId: newActivity.typeId,
        region: newActivity.region,
        space: newActivity.space,
        participants: newActivity.participants,
        ...newActivity.data // Spread activity-specific fields
      }

      const response = await fetch('/api/activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (response.ok) {
        const startedActivity = await response.json()
        addActivity(startedActivity)
        if (isTourLaunchArmed) {
          setTourCreatedActivityId(startedActivity.id)
          setIsTourLaunchArmed(false)
        }

        if (newActivity.type === 'ratting') {
          const rattingPreset = {
            space: newActivity.space,
            npcFaction: newActivity.data?.npcFaction,
            siteType: newActivity.data?.siteType,
            siteName: newActivity.data?.siteName,
            participants: newActivity.participants || [],
            autoLootTrackingEnabled: !!newActivity.data?.autoLootTrackingEnabled,
            autoLootCharacterId: newActivity.data?.autoLootCharacterId || null,
            autoLootStructureId: newActivity.data?.autoLootStructureId || null,
            autoLootStructureName: newActivity.data?.autoLootStructureName || '',
            autoLootContainerId: newActivity.data?.autoLootContainerId || null,
            autoLootContainerName: newActivity.data?.autoLootContainerName || '',
          }
          localStorage.setItem(rattingPresetStorageKey, JSON.stringify(rattingPreset))
        }

        if (newActivity.type === 'mining') {
          const miningPreset = {
            space: newActivity.space,
            miningType: newActivity.data?.miningType,
            participants: newActivity.participants || [],
          }
          localStorage.setItem(miningPresetStorageKey, JSON.stringify(miningPreset))
        }

        setIsDialogOpen(false)
        // Reset form — keep mission category aligned with current tracker tab
        setNewActivity({
          type: (typeParam as any) || 'mining',
          status: 'active',
          participants: [],
          data: {
            lastCargoState: '',
            totalLootValue: 0,
            logs: [],
            trackingMode: 'automatic',
          },
        })
      } else {
        const errorData = await response.json()
        toast.error(errorData.error || 'Failed to start activity')
      }
    } catch (error) {
      console.error('Error starting activity:', error)
      toast.error('Failed to start activity due to network error')
    }
  }

  const handleEndActivity = async (id: string) => {
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed', endTime: new Date().toISOString() })
      })

      if (response.ok) {
        updateActivity(id, { status: 'completed', endTime: new Date() })
      } else {
        toast.error('Failed to end activity')
      }
    } catch (error) {
      console.error('Error ending activity:', error)
      toast.error('Failed to end activity')
    }
  }

  const handleDeleteActivity = async (id: string) => {
    try {
      const response = await fetch(`/api/activities/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        removeActivity(id)
        setSelectedHistoryActivity((prev: any) => (prev?.id === id ? null : prev))
        // Refresh the current page to update pagination counts and list
        void fetchFromAPI(typeParam ?? undefined, pagination.page, historyPageLimit)
      }
    } catch (error) {
      console.error('Error deleting activity:', error)
    }
  }

  const handleOpenHistoryDetail = async (activity: any) => {
    setSelectedHistoryActivity(activity)
    setIsLoadingHistoryDetail(true)
    try {
      const response = await fetch(`/api/activities/${activity.id}`)
      if (!response.ok) return
      const fullActivity = await response.json()
      if (fullActivity?.id === activity.id) {
        setSelectedHistoryActivity(fullActivity)
      }
    } catch (error) {
      console.error('Failed to fetch full activity detail:', error)
    } finally {
      setIsLoadingHistoryDetail(false)
    }
  }

  const toggleParticipant = (characterId: number, characterName: string) => {
    const current = newActivity.participants || []
    const exists = current.find(p => p.characterId === characterId)
    const busy = isCharacterBusy(characterId)
    
    if (exists) {
      setNewActivity({
        ...newActivity,
        participants: current.filter(p => p.characterId !== characterId)
      })
    } else if (!busy) {
      if (!hasPremium && current.length >= 1) {
        return
      }

      setNewActivity({
        ...newActivity,
        participants: [...current, { characterId, characterName }]
      })
    }
  }

  const setParticipantFit = (characterId: number, fitId: string) => {
    const current = newActivity.participants || []
    const fit = userFits.find(f => f.id === fitId)
    setNewActivity({
      ...newActivity,
      participants: current.map(p => 
        p.characterId === characterId ? { 
          ...p, 
          fit: fitId, 
          fitName: fit?.name, // Store name for display
          shipTypeId: fit?.shipTypeId 
        } : p
      )
    })
  }

  // Helper to update fields within data
  const updateData = (fields: any) => {
    setNewActivity(prev => ({
      ...prev,
      data: { ...(prev.data || {}), ...fields }
    }))
  }

  const completedActivities = activities.filter(a => a.status === 'completed')
  const isRattingFactionRequired = newActivity.space !== 'Wormhole' && newActivity.space !== 'Pochven'
  const isRattingConfigurationReady = newActivity.type === 'ratting'
    && Boolean(newActivity.space)
    && Boolean(newActivity.data?.siteName)
    && (isRattingFactionRequired ? Boolean(newActivity.data?.npcFaction) : true)
  const markRattingConfigInteraction = () => {
    setRattingConfigInteractionCount((prev) => prev + 1)
  }

  const currentTypeInfo = ACTIVITY_TYPES.find(t => t.id === typeParam)
  
  const totalQuantity = activities
    .filter(a => a.type === 'mining')
    .reduce((sum, a) => sum + (Number(a.data?.quantity) || 0), 0)
    
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / 3600000)
    const mins = Math.floor((ms % 3600000) / 60000)
    return `${hours}h ${mins}m`
  }

  const totalDuration = useMemo(() => {
    if (!mounted) return 0
    return activities.reduce((sum, a) => {
      const start = new Date(a.startTime).getTime()
      if (isNaN(start)) return sum
      const end = a.endTime ? new Date(a.endTime).getTime() : new Date().getTime()
      return sum + (end - start)
    }, 0)
  }, [activities, mounted])

  return (
    <div className="space-y-6 pb-20" data-tour="activity-tracker-page">
      <ActivityOnboardingTour
        userId={session?.user?.id ?? null}
        isNewActivityDialogOpen={isDialogOpen}
        selectedActivityType={newActivity.type}
        rattingConfigInteractionCount={rattingConfigInteractionCount}
        selectedParticipantCount={newActivity.participants?.length ?? 0}
        activeActivityCount={activeActivities.length}
        hasTourCreatedActivity={!!tourCreatedActivityId && activeActivities.some((activity) => activity.id === tourCreatedActivityId)}
        isRattingConfigurationReady={isRattingConfigurationReady}
        onResetTourCreatedActivity={() => setTourCreatedActivityId(null)}
        onRequestOpenNewActivityDialog={() => {
          if (!canStartNewActivity) return
          setIsDialogOpen(true)
        }}
        onRequestCloseNewActivityDialog={() => setIsDialogOpen(false)}
        onRequestClearOverlaysForCardStep={() => {
          setIsDialogOpen(false)
          setShowAutoLootHelp(false)
          setSelectedHistoryActivity(null)
          setConfigActivityId(null)
        }}
      />
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {(() => {
              const ui = ACTIVITY_UI_MAPPING[typeParam || '']
              const Icon = ui?.icon
              return Icon ? <Icon className={cn("h-5 w-5", ui?.color)} /> : null
            })()}
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              {currentTypeInfo ? `${currentTypeInfo.label} Tracker` : 'Activity Tracker'}
              <Clock />
            </h1>
          </div>
          <p className="text-gray-400">{t('global.trackFleetActivities')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (open && !canStartNewActivity) return
          setIsDialogOpen(open)
        }}>
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-white hover:bg-zinc-800/80"
                    onClick={() => window.dispatchEvent(new Event(ACTIVITY_TOUR_START_EVENT))}
                    aria-label="Start new tour"
                    data-tour="restart-tour-button"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>New tour</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <DialogTrigger asChild>
              <Button 
                disabled={!canStartNewActivity}
                className={cn(
                  "font-bold gap-2",
                  canStartNewActivity 
                    ? "bg-eve-accent text-black hover:bg-eve-accent/80" 
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                )}
                data-tour="start-new-activity"
              >
                {canStartNewActivity ? (
                  <>
                    <Play className="h-4 w-4 fill-current" />
                    Start New Activity
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Premium Required for 2+ Activities
                  </>
                )}
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="bg-[#050507] border-eve-border/30 text-white max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="bg-gradient-to-r from-eve-dark to-zinc-950 p-6 border-b border-eve-border/20">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                      <div className="h-6 w-1 bg-eve-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]" />
                      Launch Activity Fleet
                    </DialogTitle>
                    <DialogDescription className="text-zinc-500 text-xs font-medium">
                      Configure your tactical operations and fleet deployment.
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <NewActivityHelpTooltip />
                  </div>
                </div>
              </DialogHeader>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 divide-y lg:divide-y-0 lg:divide-x divide-eve-border/10">
              <div className="lg:col-span-3 p-6 space-y-8">
                {/* Activity Type Selection */}
                <div className="space-y-4">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" />
                    Mission Category
                  </Label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2" data-tour="activity-type-selector">
                    {ACTIVITY_TYPES.map((type) => {
                      const globalConfig = moduleConfigs.find(c => c.module === type.id)
                      const isGloballyActive = globalConfig ? globalConfig.isActive : true
                      const hasAccess = (userAllowedActivities.includes(type.id) || userRole === 'master') && isGloballyActive
                      const isSelected = newActivity.type === type.id
                      return (
                        <button
                          key={type.id}
                          disabled={!hasAccess}
                          onClick={() => setNewActivity({ ...newActivity, type: type.id as any })}
                          data-tour={type.id === 'ratting' ? 'activity-type-ratting' : undefined}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 gap-3 relative group",
                            !hasAccess && "opacity-30 cursor-not-allowed grayscale",
                            isSelected 
                              ? "border-eve-accent bg-eve-accent/5 shadow-[0_0_20px_rgba(0,255,255,0.05)]" 
                              : "border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700"
                          )}
                        >
                          <div className="relative">
                            {(() => {
                              const ui = ACTIVITY_UI_MAPPING[type.id]
                              const Icon = ui?.icon
                              if (!isGloballyActive) {
                                return (
                                  <div className="relative">
                                    {Icon && <Icon className={cn("h-6 w-6 opacity-20", ui?.color)} />}
                                    <Lock className="h-4 w-4 text-red-500 absolute -top-1 -right-1" />
                                  </div>
                                )
                              }
                              if (!hasAccess) return <Lock className="h-6 w-6 text-gray-500" />
                              return Icon ? <Icon className={cn("h-6 w-6 transition-transform group-hover:scale-110", ui?.color)} /> : <Box className="h-6 w-6 text-gray-500" />
                            })()}
                          </div>
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", isSelected ? "text-white" : "text-zinc-500 group-hover:text-zinc-400")}>{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Tactical Config */}
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
                    <Target className="h-3 w-3" />
                    Tactical Configuration
                  </Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-900/50 backdrop-blur-sm" data-tour="ratting-config">
                    {newActivity.type !== 'abyssal' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Security Level / Space</Label>
                        <Select 
                          value={newActivity.space} 
                          onValueChange={(v) => {
                            setNewActivity({ ...newActivity, space: v })
                            if (newActivity.type === 'ratting') {
                              markRattingConfigInteraction()
                              updateData({ siteName: undefined })
                              setAnomalies([])
                            }
                          }}
                        >
                          <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 focus:ring-eve-accent/20">
                            <SelectValue placeholder="Select Space" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800"><ActivitySelectContentList items={SPACE_TYPES} /></SelectContent>
                        </Select>
                      </div>
                    )}

                    {newActivity.type === 'abyssal' && (
                      <div className="space-y-2 col-span-1 sm:col-span-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                            Initial Cargo State
                          </Label>
                          <ActivityTypeHelpTooltip activityType="abyssal" />
                        </div>
                        <Label className="text-[8px] text-purple-400/60 animate-pulse">Required for Abyssal delta</Label>
                        <div className="relative group/cargo">
                          <textarea
                            placeholder="PASTE CARGO BEFORE FIRST ABYSSAL RUN..."
                            className="w-full h-24 p-3 bg-zinc-900/80 border-zinc-800 text-purple-300 placeholder:text-zinc-700 font-mono text-[10px] focus:ring-purple-500/20 rounded-xl resize-none border transition-all hover:bg-zinc-900"
                            onChange={(e) => updateData({ lastCargoState: e.target.value })}
                            value={newActivity.data?.lastCargoState || ''}
                          />
                        </div>
                      </div>
                    )}

                    {newActivity.type === 'ratting' && (
                      <>
                        <div className="space-y-2">
                          <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Hostile Faction</Label>
                        <Select
                          value={newActivity.data?.npcFaction || ''}
                          disabled={newActivity.space === 'Wormhole' || newActivity.space === 'Pochven'}
                          onValueChange={(v) => {
                            markRattingConfigInteraction()
                            updateData({ npcFaction: v, siteName: undefined })
                            setAnomalies([])
                          }}
                        >
                            <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 focus:ring-eve-accent/20">
                              <SelectValue placeholder={newActivity.space === 'Wormhole' ? 'Sleepers' : newActivity.space === 'Pochven' ? 'Triglavian' : 'Select Faction'} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800"><ActivitySelectContentList items={NPC_FACTIONS} /></SelectContent>
                          </Select>
                        </div>
                        
                          <div className="space-y-2 col-span-1 sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                Detected Anomalies ({newActivity.data?.npcFaction || 'Awaiting Faction'})
                              </Label>
                              <div className="flex items-center gap-2">
                                <ActivityTypeHelpTooltip activityType="ratting" />
                                {newActivity.data?.siteName && (
                                  <AnomaliesIntelDialog anomalyName={newActivity.data.siteName} />
                                )}
                              </div>
                            </div>
                            <Select value={newActivity.data?.siteName || ''} onValueChange={(v) => {
                              markRattingConfigInteraction()
                              updateData({ siteName: v })
                            }}>
                              <SelectTrigger className="h-11 bg-zinc-900 border-zinc-800 text-cyan-400 font-mono focus:ring-eve-accent/20">
                                <SelectValue placeholder="SELECT ANOMALY TARGET" />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                {anomalies.map((a: any) => (
                                  <SelectItem key={a.id} value={a.name} className="font-mono text-xs">{a.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                        <div className="space-y-2 col-span-1 sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Auto Loot Tracking</Label>
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 leading-none bg-blue-500/10 text-blue-400 border-blue-500/20 font-black uppercase">New</Badge>
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3 leading-none bg-orange-500/10 text-orange-400 border-orange-500/20 font-black uppercase">Beta</Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setShowAutoLootHelp(true)}
                                className="h-5 w-5 rounded-full border border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-500 text-[10px] font-bold"
                                aria-label="Auto loot tracking help"
                              >
                                ?
                              </button>
                              <Switch
                                checked={!!newActivity.data?.autoLootTrackingEnabled}
                                onCheckedChange={(checked) => {
                                  markRattingConfigInteraction()
                                  updateData({
                                    autoLootTrackingEnabled: checked,
                                    ...(checked ? {} : { autoLootCharacterId: undefined, autoLootContainerId: undefined, autoLootContainerName: undefined }),
                                  })
                                }}
                              />
                            </div>
                          </div>
                          {newActivity.data?.autoLootTrackingEnabled && (
                            <div className={cn(
                              "grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border p-3",
                              rattingContainerValidation === 'valid' ? "border-emerald-500/40 bg-emerald-500/5" :
                                rattingContainerValidation === 'invalid' ? "border-red-500/40 bg-red-500/5" :
                                  "border-zinc-800 bg-zinc-900/40"
                            )}>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zinc-500 uppercase font-bold">Character</Label>
                                <Select
                                  value={String(newActivity.data?.autoLootCharacterId || '')}
                                  onValueChange={(value) => {
                                    markRattingConfigInteraction()
                                    updateData({ 
                                      autoLootCharacterId: Number(value), 
                                      autoLootContainerId: undefined, 
                                      autoLootContainerName: undefined,
                                      autoLootStructureId: undefined,
                                      autoLootStructureName: undefined,
                                    })
                                  }}
                                >
                                  <SelectTrigger className="h-9 bg-zinc-900 border-zinc-800">
                                    <SelectValue placeholder="Select character" />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-800">
                                    {session?.user?.characters?.map((char) => (
                                      <SelectItem key={char.id} value={String(char.id)} className="text-xs">{char.name}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zinc-500 uppercase font-bold">Structure</Label>
                                <StructureCombobox
                                  characterId={newActivity.data?.autoLootCharacterId || null}
                                  value={newActivity.data?.autoLootStructureId ? { 
                                    id: newActivity.data.autoLootStructureId, 
                                    name: newActivity.data.autoLootStructureName || '', 
                                    solarSystem: '', 
                                    assetCount: 0 
                                  } : null}
                                  onChange={(structure) => {
                                    markRattingConfigInteraction()
                                    if (!structure) {
                                      updateData({ 
                                        autoLootStructureId: undefined, 
                                        autoLootStructureName: undefined,
                                        autoLootContainerId: undefined,
                                        autoLootContainerName: undefined,
                                      })
                                    } else {
                                      updateData({ 
                                        autoLootStructureId: structure.id, 
                                        autoLootStructureName: structure.name,
                                        autoLootContainerId: undefined,
                                        autoLootContainerName: undefined,
                                      })
                                    }
                                  }}
                                  disabled={!newActivity.data?.autoLootCharacterId}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-zinc-500 uppercase font-bold">Container</Label>
                                <ContainerCombobox
                                  characterId={newActivity.data?.autoLootCharacterId || null}
                                  structureId={newActivity.data?.autoLootStructureId || null}
                                  value={newActivity.data?.autoLootContainerId ? {
                                    itemId: newActivity.data.autoLootContainerId,
                                    typeId: 0,
                                    typeName: newActivity.data.autoLootContainerName || '',
                                    customName: newActivity.data.autoLootContainerName || '',
                                    locationId: newActivity.data.autoLootStructureId || 0,
                                    locationName: newActivity.data.autoLootStructureName || '',
                                  } : null}
                                  onChange={(container) => {
                                    markRattingConfigInteraction()
                                    if (!container) {
                                      updateData({ 
                                        autoLootContainerId: undefined,
                                        autoLootContainerName: undefined,
                                      })
                                    } else {
                                      updateData({ 
                                        autoLootContainerId: container.itemId,
                                        autoLootContainerName: container.customName,
                                      })
                                    }
                                  }}
                                  disabled={!newActivity.data?.autoLootCharacterId || !newActivity.data?.autoLootStructureId}
                                />
                              </div>
                              <p className={cn(
                                "text-[10px] uppercase font-bold tracking-tight sm:col-span-3",
                                rattingContainerValidation === 'valid' ? "text-emerald-400" :
                                  rattingContainerValidation === 'invalid' ? "text-red-400" : "text-zinc-500"
                              )}>
                                {rattingContainerValidation === 'checking' && 'Loading...'}
                                {rattingContainerValidation === 'valid' && `Tracking: ${newActivity.data?.autoLootContainerName || 'Unknown'}`}
                                {rattingContainerValidation === 'invalid' && 'No containers found.'}
                                {rattingContainerValidation === 'idle' && 'Select structure and container to enable auto loot tracking.'}
                              </p>
                            </div>
                          )}
                        </div>
                      </>
                    )}

                    {newActivity.type === 'mining' && (
                      <div className="space-y-3 sm:col-span-2">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Mining Category</Label>
                            <ActivityTypeHelpTooltip activityType="mining" />
                          </div>
                          <Select
                            value={newActivity.data?.miningType || ''}
                            onValueChange={(v) => updateData({ miningType: v })}
                          >
                            <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 focus:ring-blue-500/20">
                              <SelectValue placeholder="Select Category" />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800">
                              {MINING_TYPES.map((type) => (
                                <SelectItem key={type} value={type} className="text-xs uppercase font-mono">
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <MiningSetupValuableOresPreview
                          space={newActivity.space}
                          miningType={newActivity.data?.miningType}
                        />
                      </div>
                    )}
                    {newActivity.type === 'exploration' && (
                      <div className="space-y-4 col-span-1 sm:col-span-2">
                        <div className="grid grid-cols-1 sm:grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                Initial Cargo State
                              </Label>
                              <ActivityTypeHelpTooltip activityType="exploration" />
                            </div>
                            <Label className="text-[8px] text-eve-accent/50 animate-pulse">{t('global.criticalForLootDelta')}</Label>
                            <div className="relative group/cargo">
                              <textarea 
                                placeholder="PASTE CURRENT CARGO (Ctrl+A -> Ctrl+C in Inventory list view)..."
                                className="w-full h-24 p-3 bg-zinc-900/80 border-zinc-800 text-blue-400 placeholder:text-zinc-700 font-mono text-[10px] focus:ring-eve-accent/20 rounded-xl resize-none border transition-all hover:bg-zinc-900"
                                onChange={(e) => updateData({ lastCargoState: e.target.value })}
                              />
                              <div className="absolute right-3 bottom-3 opacity-20 pointer-events-none">
                                <Box className="h-4 w-4 text-eve-accent" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Placeholder for other types */}
                    {newActivity.type !== 'ratting' && newActivity.type !== 'mining' && newActivity.type !== 'abyssal' && newActivity.type !== 'exploration' && (
                      <div className="col-span-1 sm:col-span-2 py-4 flex items-center justify-between px-4">
                        <span className="text-zinc-600 text-xs italic">
                          Advanced configuration for {newActivity.type} coming soon.
                        </span>
                        <ActivityTypeHelpTooltip activityType={newActivity.type as any} />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fleet Deployment Section */}
              <div className="lg:col-span-2 p-6 bg-zinc-950/30 space-y-6" data-tour="fleet-deployment">
                {hasPremium && (
                  <FleetTemplateSelector
                    characters={session?.user?.characters || []}
                    selectedParticipants={newActivity.participants || []}
                    onParticipantsChange={(participants) => {
                      setNewActivity(prev => ({ ...prev, participants }))
                    }}
                    activityType={newActivity.type || 'ratting'}
                    isPremium={hasPremium}
                  />
                )}
                
                <div className="space-y-4">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
                    <Users className="h-3 w-3" />
                    Fleet Deployment {hasPremium && <span className="text-[8px] text-amber-400/60">(Manual Select)</span>}
                  </Label>
                  
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {session?.user?.characters?.map((char) => {
                      const busy = isCharacterBusy(char.id)
                      const participant = newActivity.participants?.find(p => p.characterId === char.id)
                      const selected = !!participant
                      
                      return (
                        <div key={char.id} className="space-y-2 animate-in fade-in duration-300">
                          <button
                            onClick={() => toggleParticipant(char.id, char.name)}
                            data-tour="fleet-participant-toggle"
                            className={cn(
                              "w-full flex items-center gap-4 p-3 rounded-xl border transition-all duration-300 relative overflow-hidden group/char",
                              selected 
                                ? "border-eve-accent bg-eve-accent/10 shadow-[0_0_15px_rgba(0,255,255,0.05)]" 
                                : busy
                                  ? "border-zinc-800/50 bg-zinc-900/20 opacity-60 grayscale cursor-not-allowed"
                                  : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900",
                            )}
                          >
                            <div className="relative">
                              <Avatar className="h-10 w-10 ring-2 ring-zinc-800 group-hover/char:ring-eve-accent/50 transition-all">
                                <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=64`} />
                                <AvatarFallback>{char.name[0]}</AvatarFallback>
                              </Avatar>
                              {selected && <div className="absolute -top-1 -right-1 h-3 w-3 bg-eve-accent rounded-full border-2 border-[#050507]" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs font-bold truncate", selected ? "text-white" : "text-zinc-400")}>{char.name}</p>
                              <p className="text-zinc-500 font-bold mt-0.5">{participant?.fitName || participant?.fit || 'No Fit selected'}</p>
                              {busy && <Badge variant="destructive" className="h-4 px-1 text-[8px] font-black uppercase">Busy</Badge>}
                            </div>
                          </button>
                          
                          {selected && (
                            <div className="pl-4 border-l-2 border-eve-border/30 ml-5 py-1">
                              {!hasPremium && (
                                <p className="text-[9px] uppercase font-black text-eve-accent/40 mb-1 flex items-center gap-1">
                                  <Lock className="h-2 w-2" />
                                  Fleet Tracking is Premium
                                </p>
                              )}
                              <Select 
                                value={participant.fit || ''} 
                                onValueChange={(v) => setParticipantFit(char.id, v)}
                                disabled={!hasPremium} // Disable fits for free users as per requirement
                              >
                                <SelectTrigger className="h-9 text-[10px] bg-zinc-900/50 border-zinc-800 font-bold uppercase tracking-tighter">
                                  <SelectValue placeholder={hasPremium ? "SELECT LOADOUT/FIT" : "FITS ARE PREMIUM"} />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-zinc-800">
                                  {userFits.map(fit => (
                                    <SelectItem key={fit.id} value={fit.id} className="text-[10px] uppercase font-bold">
                                      {fit.name} <span className="text-zinc-500">[{fit.shipName}]</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Pre-flight Check */}
                <div className="pt-6 border-t border-eve-border/10 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Pre-flight Check</span>
                    {newActivity.participants && newActivity.participants.length > 0 ? (
                      <span className="text-[10px] font-bold text-green-500 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Ready
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> No Crew
                      </span>
                    )}
                  </div>
                  <div className="bg-zinc-900/50 rounded-xl p-4 space-y-2 border border-zinc-900/50">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Operations</span>
                      <span className="text-white font-bold">{newActivity.type?.toUpperCase() || '—'}</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Fleet Strength</span>
                      <span className="text-white font-bold">{newActivity.participants?.length || 0} Pilots</span>
                    </div>
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">Targeting</span>
                      <span className="text-eve-accent font-bold truncate max-w-[120px] text-right">
                        {newActivity.type === 'mining'
                          ? newActivity.data?.miningType || 'UNASSIGNED'
                          : newActivity.data?.siteName || 'UNASSIGNED'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-950 p-6 border-t border-eve-border/10 flex items-center justify-between">
              <Button 
                variant="ghost" 
                onClick={() => setIsDialogOpen(false)}
                className="text-zinc-500 hover:text-white uppercase text-[10px] font-black tracking-widest"
              >
                Abort Mission
              </Button>
              <Button 
                onClick={handleStartActivity}
                disabled={!newActivity.participants?.length || !newActivity.type}
                className="bg-eve-accent text-black hover:bg-eve-accent/80 font-black uppercase text-xs tracking-widest px-8 py-6 rounded-xl shadow-[0_0_30px_rgba(0,255,255,0.2)] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 h-auto"
                data-tour="launch-fleet-operations"
              >
                <Play className="h-4 w-4 mr-2 fill-current" />
                Launch Fleet Operations
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-eve-accent/20">
                <TrendingUp className="h-6 w-6 text-eve-accent" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Operations</p>
                <p className="text-2xl font-bold text-white">{pagination.total + pagination.activeCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/20">
                <Clock className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Total Duration</p>
                <p className="text-2xl font-bold text-white" suppressHydrationWarning>
                  {mounted ? formatDuration(totalDuration) : '--h --m'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-eve-panel border-eve-border">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
                <Users className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Active Fleets</p>
                <p className="text-2xl font-bold text-white">{activeActivities.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {typeParam === 'mining' ? (
          <Card className="bg-eve-panel border-eve-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/20">
                  <Gem className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Mined</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(totalQuantity)} m³</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-eve-panel border-eve-border">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-500/20">
                  <DollarSign className="h-6 w-6 text-yellow-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-400">
                    {formatISK(
                      activeActivities.reduce(
                        (sum, a) => sum + getActivityFinancialMetrics({ type: a.type, data: a.data }).gross,
                        0
                      )
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Active Activities Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-tour="active-activities-section">
        {activeActivities.length === 0 ? (
          <Card className="col-span-full bg-eve-panel border-dashed border-eve-border py-12">
            <CardContent className="flex flex-col items-center justify-center text-center">
              <div className="bg-eve-dark p-4 rounded-full mb-4">
                <Target className="h-10 w-10 text-gray-600" />
              </div>
              <h3 className="text-lg font-medium text-white">{t('global.noActiveOperations')}</h3>
              <p className="text-sm text-gray-500 max-w-xs mt-2">
                {t('global.launchNewActivity')}
              </p>
            </CardContent>
          </Card>
        ) : (
          activeActivities.map((activity, idx) => (
            <div
              key={activity.id}
              data-tour={activity.id === tourCreatedActivityId ? 'active-activity-card' : undefined}
            >
              <ActivityCard
                activity={activity}
                index={idx}
                onEnd={() => handleEndActivity(activity.id)}
              />
            </div>
          ))
        )}
      </div>

      {/* Recent History */}
      <Card className="bg-eve-panel border-eve-border overflow-hidden">
        <CardHeader className="pb-4">
          <ActivityHistoryHeader
            activities={completedActivities}
            title={t('common.operationHistory')}
            density={historyDensity}
            onDensityChange={setHistoryDensity}
            pageLimit={historyPageLimit}
            onPageLimitChange={setHistoryPageLimit}
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-500">{pagination.total} {t('common.records')}</span>
          </div>
        </CardHeader>
        <CardContent>
          <OperationHistoryList
            completedActivities={completedActivities}
            pagination={pagination}
            density={historyDensity}
            pageLimit={historyPageLimit}
            typeParam={typeParam ?? undefined}
            onDelete={handleDeleteActivity}
            onOpenDetail={handleOpenHistoryDetail}
            onFetchPage={(type, page, limit) => {
              void fetchFromAPI(type, page, limit)
            }}
            noOperationText={t('common.noOperation')}
            startActivityHintText={t('common.startActivityHint')}
          />
        </CardContent>
      </Card>

      {/* Abyssal Configuration Dialog (Post-Launch) */}
      <AbyssalConfigDialog 
        activityId={configActivityId} 
        onClose={() => setConfigActivityId(null)} 
      />

      {selectedHistoryActivity && (
        <ActivityDetailDialog
          activity={selectedHistoryActivity}
          open={!!selectedHistoryActivity}
          onOpenChange={(open) => {
            if (!open) setSelectedHistoryActivity(null)
          }}
        />
      )}
      {isLoadingHistoryDetail && (
        <div className="fixed bottom-4 right-4 z-50 rounded-md border border-white/10 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300">
          Loading full history details...
        </div>
      )}

      <Dialog open={showAutoLootHelp} onOpenChange={setShowAutoLootHelp}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider">Auto Loot Tracking</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              When enabled, the system checks the selected character assets for the container name and tries to track loot automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs text-zinc-300">
            <p>- Manual loot entry remains available.</p>
            <p>- If manual and auto tracking are both used, duplicated loot entries may happen.</p>
            <p>- If container is not found, you can still start the activity.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
