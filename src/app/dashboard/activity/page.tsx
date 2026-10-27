'use client'

import { useState, useEffect, useMemo, Suspense, useCallback, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTranslations } from '@/i18n/hooks'
import { ActivityDetailDialog } from '@/components/activity/ActivityDetailDialog'
import { NewActivityHelpTooltip } from '@/components/activity/NewActivityHelpTooltip'
import { ActivityTypeHelpTooltip } from '@/components/activity/ActivityTypeHelpTooltip'
import { ActivityOnboardingTour } from '@/components/activity/ActivityOnboardingTour'
import { MiningSetupValuableOresPreview } from '@/components/activity/MiningSetupValuableOresPreview'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { AutoLootTrackingPanel } from '@/components/activity/AutoLootTrackingPanel'
import { Combobox } from '@/components/ui/combobox'
import { 
  Play, 
  Clock, 
  Users, 
  CheckCircle,
  XCircle,
  Loader2,
  Target,
  HelpCircle,
  TrendingUp,
  Box,
  Lock,
  BarChart3,
} from 'lucide-react'
import { cn, isPremium } from '@/lib/utils'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'
import { useActivityStore, type Activity } from '@/lib/stores/activity-store'
import {
  ABYSSAL_DEFAULT_SHIP,
  ABYSSAL_DEFAULT_TIER,
  ABYSSAL_DEFAULT_WEATHER,
} from '@/lib/activities/abyssal-defaults'
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
import { ActivityStatsPanel, TrackerHealthPanel } from '@/app/dashboard/activity/activity-overview-panels'
import { ActiveOperationsPanel, OperationHistoryPanel } from '@/app/dashboard/activity/activity-sections'
import {
  ACTIVITY_TOUR_LAUNCH_ARM_EVENT,
  ACTIVITY_TOUR_LAUNCH_DISARM_EVENT,
  ACTIVITY_TOUR_START_EVENT,
} from '@/lib/activity-tour/storage'
import { validateLaunchActivityInput } from '@/lib/activities/activity-launch'
import { canSelectActivityType } from '@/lib/activities/activity-access'

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
  const hasPremium = isPremium(session?.user?.subscriptionEnd)
  const searchParams = useSearchParams()
  const typeParam = searchParams.get('type')?.toLowerCase()
  
  const {
    activities,
    pagination,
    isLoading,
    lastError,
    lastFetchAt,
    lastSyncAt,
    addActivity,
    updateActivity,
    removeActivity,
    isCharacterBusy,
    fetchBusyCharacterIdsGlobal,
    fetchFromAPI,
    startPolling,
    stopPolling,
    startRattingAutoSync,
    stopRattingAutoSync,
    startMiningAutoSync,
    stopMiningAutoSync,
    startAbyssalAutoSync,
    stopAbyssalAutoSync,
    startExplorationAutoSync,
    stopExplorationAutoSync,
    startSalvagingAutoSync,
    stopSalvagingAutoSync,
    startEscalationsAutoSync,
    stopEscalationsAutoSync,
  } = useActivityStore(
    useShallow((s) => ({
      activities: s.activities,
      pagination: s.pagination,
      isLoading: s.isLoading,
      lastError: s.lastError,
      lastFetchAt: s.lastFetchAt,
      lastSyncAt: s.lastSyncAt,
      addActivity: s.addActivity,
      updateActivity: s.updateActivity,
      removeActivity: s.removeActivity,
      isCharacterBusy: s.isCharacterBusy,
      fetchBusyCharacterIdsGlobal: s.fetchBusyCharacterIdsGlobal,
      fetchFromAPI: s.fetchFromAPI,
      startPolling: s.startPolling,
      stopPolling: s.stopPolling,
      startRattingAutoSync: s.startRattingAutoSync,
      stopRattingAutoSync: s.stopRattingAutoSync,
      startMiningAutoSync: s.startMiningAutoSync,
      stopMiningAutoSync: s.stopMiningAutoSync,
      startAbyssalAutoSync: s.startAbyssalAutoSync,
      stopAbyssalAutoSync: s.stopAbyssalAutoSync,
      startExplorationAutoSync: s.startExplorationAutoSync,
      stopExplorationAutoSync: s.stopExplorationAutoSync,
      startSalvagingAutoSync: s.startSalvagingAutoSync,
      stopSalvagingAutoSync: s.stopSalvagingAutoSync,
      startEscalationsAutoSync: s.startEscalationsAutoSync,
      stopEscalationsAutoSync: s.stopEscalationsAutoSync,
    }))
  )
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [userFits, setUserFits] = useState<any[]>([])
  const [moduleConfigs, setModuleConfigs] = useState<any[]>([])
  const [configActivityId, setConfigActivityId] = useState<string | null>(null)
  const [historyPageLimit, setHistoryPageLimit] = useState(10)
  const [selectedHistoryActivity, setSelectedHistoryActivity] = useState<any | null>(null)
  const [isLoadingHistoryDetail, setIsLoadingHistoryDetail] = useState(false)
  const [tourCreatedActivityId, setTourCreatedActivityId] = useState<string | null>(null)
  const [isTourLaunchArmed, setIsTourLaunchArmed] = useState(false)
  const [rattingConfigInteractionCount, setRattingConfigInteractionCount] = useState(0)
  const viewId = searchParams.get('viewId')

  const handleOpenHistoryDetail = useCallback(async (activity: any) => {
    setSelectedHistoryActivity(activity)
    setIsLoadingHistoryDetail(true)
    try {
      const response = await fetch(`/api/activities/${activity.id}`)
      if (!response.ok) {
        toast.error(t('activity.loadActivityDetailsError'))
        return
      }
      const fullActivity = await response.json()
      if (fullActivity?.id === activity.id) {
        setSelectedHistoryActivity(fullActivity)
      }
    } catch (error) {
      console.error('Failed to fetch full activity detail:', error)
      toast.error(t('activity.loadActivityDetailsError'))
    } finally {
      setIsLoadingHistoryDetail(false)
    }
  }, [t])

  const viewIdHandledRef = useRef<string | null>(null)

  useEffect(() => {
    if (viewId && activities.length > 0 && viewIdHandledRef.current !== viewId) {
      viewIdHandledRef.current = viewId
      const activity = activities.find(a => a.id === viewId)
      if (activity) {
        void handleOpenHistoryDetail(activity)
      } else {
        // If not in current list (maybe on another page), fetch it directly
        const fetchAndOpen = async () => {
          try {
            const res = await fetch(`/api/activities/${viewId}`)
            if (res.ok) {
              const fullActivity = await res.json()
              void handleOpenHistoryDetail(fullActivity)
            }
          } catch (err) {
            console.error('Failed to fetch viewId activity:', err)
          }
        }
        void fetchAndOpen()
      }
    }
  }, [viewId, activities, handleOpenHistoryDetail]) // Only run once or when viewId/activities change


  useOpenAbyssalConfigListener(setConfigActivityId)
  useActivityFitsModules(setUserFits, setModuleConfigs, hasPremium)

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
    type: (() => {
      if (!typeParam) return 'mining'
      const typeOption = ACTIVITY_TYPES.find((t) => t.id === typeParam)
      if (typeOption?.comingSoon) return 'mining'
      return typeParam as Activity['type']
    })(),
    status: 'active',
    participants: [],
    data: {
      lastCargoState: '',
      totalLootValue: 0,
      logs: [],
      trackingMode: 'automatic',
      lastRunDefaults: {
        tier: ABYSSAL_DEFAULT_TIER,
        weather: ABYSSAL_DEFAULT_WEATHER,
        ship: ABYSSAL_DEFAULT_SHIP,
      },
    },
  })

  const [anomalies, setAnomalies] = useState<any[]>([])
  const [autoLootContainerValidation, setAutoLootContainerValidation] = useState<'idle' | 'valid' | 'invalid' | 'checking' | 'multiple'>('idle')
  const [showAutoLootHelp, setShowAutoLootHelp] = useState(false)
  const [autoLootFeatureEnabled, setAutoLootFeatureEnabled] = useState(true)
  const [isLaunching, setIsLaunching] = useState(false)

  useEffect(() => {
    async function checkAutoLootFeature() {
      try {
        const res = await fetch('/api/feature-flags')
        if (res.ok) {
          const data = await res.json()
          const enabled = data.autoLootTracking ?? true
          setAutoLootFeatureEnabled(enabled)
          if (!enabled) {
            setNewActivity((prev) => ({
              ...prev,
              data: {
                ...(prev.data || {}),
                autoLootTrackingEnabled: false,
                autoLootCharacterId: undefined,
                autoLootContainerId: undefined,
                autoLootContainerName: undefined,
                autoLootStructureId: undefined,
                autoLootStructureName: undefined,
              },
            }))
          }
        }
      } catch (err) {
        console.error('Failed to check auto loot feature flag:', err)
      }
    }
    void checkAutoLootFeature()
  }, [])

  const rattingPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-ratting-preset-${userId}`
  }, [session?.user?.id])

  const miningPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-mining-preset-${userId}`
  }, [session?.user?.id])

  const abyssalPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-abyssal-preset-${userId}`
  }, [session?.user?.id])

  const explorationPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-exploration-preset-${userId}`
  }, [session?.user?.id])

  const salvagingPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-salvaging-preset-${userId}`
  }, [session?.user?.id])

  const escalationsPresetStorageKey = useMemo(() => {
    const userId = session?.user?.id || 'anonymous'
    return `easyeve-escalations-preset-${userId}`
  }, [session?.user?.id])

  useActivityUrlTypeSync(typeParam, setNewActivity)
  useActivityTrackerLifecycle({
    typeParam,
    startPolling,
    stopPolling,
    startRattingAutoSync,
    stopRattingAutoSync,
    startMiningAutoSync,
    stopMiningAutoSync,
    startAbyssalAutoSync,
    stopAbyssalAutoSync,
    startExplorationAutoSync,
    stopExplorationAutoSync,
    startSalvagingAutoSync,
    stopSalvagingAutoSync,
    startEscalationsAutoSync,
    stopEscalationsAutoSync,
  })
  useRattingAnomalies(newActivity, setAnomalies)

  useEffect(() => {
    const savedLimit = Number(localStorage.getItem('activity-history-page-limit') || '')
    if ([10, 20, 30].includes(savedLimit)) {
      setHistoryPageLimit(savedLimit)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('activity-history-page-limit', String(historyPageLimit))
    void fetchFromAPI(typeParam ?? undefined, 1, historyPageLimit)
  }, [fetchFromAPI, historyPageLimit, typeParam])

  useEffect(() => {
    if (!isDialogOpen) return
    void fetchBusyCharacterIdsGlobal()
  }, [isDialogOpen, fetchBusyCharacterIdsGlobal])

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
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, miningPresetStorageKey])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'abyssal') return
    const rawPreset = localStorage.getItem(abyssalPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        data: {
          ...(prev.data || {}),
          lastCargoState: parsed.lastCargoState || prev.data?.lastCargoState,
          lastRunDefaults: {
            tier: parsed.lastRunDefaults?.tier || prev.data?.lastRunDefaults?.tier || ABYSSAL_DEFAULT_TIER,
            weather:
              parsed.lastRunDefaults?.weather ||
              prev.data?.lastRunDefaults?.weather ||
              ABYSSAL_DEFAULT_WEATHER,
            ship: parsed.lastRunDefaults?.ship || prev.data?.lastRunDefaults?.ship || ABYSSAL_DEFAULT_SHIP,
          },
        },
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, abyssalPresetStorageKey])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'exploration') return
    const rawPreset = localStorage.getItem(explorationPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        region: parsed.region || prev.region,
        data: {
          ...(prev.data || {}),
          lastCargoState: parsed.lastCargoState || prev.data?.lastCargoState,
          autoLootTrackingEnabled: !!parsed.autoLootTrackingEnabled,
          autoLootCharacterId: parsed.autoLootCharacterId || prev.data?.autoLootCharacterId,
          autoLootStructureId: parsed.autoLootStructureId || prev.data?.autoLootStructureId,
          autoLootStructureName: parsed.autoLootStructureName || prev.data?.autoLootStructureName,
          autoLootContainerId: parsed.autoLootContainerId || prev.data?.autoLootContainerId,
          autoLootContainerName: parsed.autoLootContainerName || prev.data?.autoLootContainerName,
        },
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, explorationPresetStorageKey])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'salvaging') return
    const rawPreset = localStorage.getItem(salvagingPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        data: {
          ...(prev.data || {}),
          npcFaction: parsed.npcFaction || prev.data?.npcFaction,
          lastCargoState: parsed.lastCargoState || prev.data?.lastCargoState,
          autoLootTrackingEnabled: !!parsed.autoLootTrackingEnabled,
          autoLootCharacterId: parsed.autoLootCharacterId || prev.data?.autoLootCharacterId,
          autoLootStructureId: parsed.autoLootStructureId || prev.data?.autoLootStructureId,
          autoLootStructureName: parsed.autoLootStructureName || prev.data?.autoLootStructureName,
          autoLootContainerId: parsed.autoLootContainerId || prev.data?.autoLootContainerId,
          autoLootContainerName: parsed.autoLootContainerName || prev.data?.autoLootContainerName,
        },
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, salvagingPresetStorageKey])

  useEffect(() => {
    if (!isDialogOpen || newActivity.type !== 'escalations') return
    const rawPreset = localStorage.getItem(escalationsPresetStorageKey)
    if (!rawPreset) return
    try {
      const parsed = JSON.parse(rawPreset)
      setNewActivity((prev) => ({
        ...prev,
        space: parsed.space || prev.space,
        data: {
          ...(prev.data || {}),
          npcFaction: parsed.npcFaction || prev.data?.npcFaction,
          lastCargoState: parsed.lastCargoState || prev.data?.lastCargoState,
        },
      }))
    } catch {
      // ignore malformed local preset
    }
  }, [isDialogOpen, newActivity.type, escalationsPresetStorageKey])

  useEffect(() => {
    const autoLootTypes = ['ratting', 'exploration', 'salvaging']
    if (!autoLootTypes.includes(newActivity.type || '')) return
    if (!newActivity.data?.autoLootTrackingEnabled) {
      setAutoLootContainerValidation('idle')
      return
    }
    const characterId = newActivity.data?.autoLootCharacterId
    const sourceMode = newActivity.data?.autoLootSourceMode || 'structure'
    const structureId = newActivity.data?.autoLootStructureId
    const containerId = newActivity.data?.autoLootContainerId

    if (!characterId || !containerId || (sourceMode === 'structure' && !structureId)) {
      setAutoLootContainerValidation('idle')
      return
    }

    let cancelled = false
    const controller = new AbortController()

    setAutoLootContainerValidation('checking')

    const params = new URLSearchParams()
    if (sourceMode === 'mtu') {
      params.set('mtuMode', 'true')
    } else {
      params.set('containerMode', 'true')
      params.set('locationId', String(structureId))
    }

    fetch(`/api/characters/${characterId}/assets?${params}`, { signal: controller.signal })
      .then((response) =>
        response.ok ? response.json() : { ok: false as const, reason: 'network' as const }
      )
      .then((result: { ok: true; data: Array<{ itemId: number }> } | { ok: false; reason: string }) => {
        if (cancelled) return
        if (!result.ok) {
          setAutoLootContainerValidation('invalid')
          return
        }
        const found = result.data.some((c) => c.itemId === containerId)
        setAutoLootContainerValidation(found ? 'valid' : 'invalid')
      })
      .catch((error: Error) => {
        if (cancelled || error.name === 'AbortError') return
        setAutoLootContainerValidation('invalid')
      })

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [
    newActivity.type,
    newActivity.data?.autoLootTrackingEnabled,
    newActivity.data?.autoLootCharacterId,
    newActivity.data?.autoLootSourceMode,
    newActivity.data?.autoLootStructureId,
    newActivity.data?.autoLootContainerId,
  ])

  // Auto-set faction for special spaces
  useEffect(() => {
    if (newActivity.type !== 'ratting') return
    if (newActivity.space === 'Wormhole') {
      updateData({ npcFaction: 'Sleepers' })
    } else if (newActivity.space === 'Pochven') {
      updateData({ npcFaction: 'Triglavian' })
    }
  }, [newActivity.space, newActivity.type])

  const activeActivities = useMemo(() => activities.filter((a) => a.status === 'active'), [activities])
  const canStartNewActivity = hasPremium || activeActivities.length === 0

  const handleStartActivity = async () => {
    if (isLaunching) return
    if (!launchValidation.isValid) {
      toast.error(launchValidation.issues[0] || 'Please complete all required fields')
      return
    }

    try {
      setIsLaunching(true)
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
          }
          localStorage.setItem(miningPresetStorageKey, JSON.stringify(miningPreset))
        }

        if (newActivity.type === 'abyssal') {
          const abyssalPreset = {
            lastCargoState: newActivity.data?.lastCargoState,
            lastRunDefaults: newActivity.data?.lastRunDefaults,
          }
          localStorage.setItem(abyssalPresetStorageKey, JSON.stringify(abyssalPreset))
        }

        if (newActivity.type === 'exploration') {
          const explorationPreset = {
            region: newActivity.region,
            lastCargoState: newActivity.data?.lastCargoState,
            autoLootTrackingEnabled: !!newActivity.data?.autoLootTrackingEnabled,
            autoLootCharacterId: newActivity.data?.autoLootCharacterId || null,
            autoLootStructureId: newActivity.data?.autoLootStructureId || null,
            autoLootStructureName: newActivity.data?.autoLootStructureName || '',
            autoLootContainerId: newActivity.data?.autoLootContainerId || null,
            autoLootContainerName: newActivity.data?.autoLootContainerName || '',
          }
          localStorage.setItem(explorationPresetStorageKey, JSON.stringify(explorationPreset))
        }

        if (newActivity.type === 'salvaging') {
          const salvagingPreset = {
            npcFaction: newActivity.data?.npcFaction,
            lastCargoState: newActivity.data?.lastCargoState,
            autoLootTrackingEnabled: !!newActivity.data?.autoLootTrackingEnabled,
            autoLootCharacterId: newActivity.data?.autoLootCharacterId || null,
            autoLootStructureId: newActivity.data?.autoLootStructureId || null,
            autoLootStructureName: newActivity.data?.autoLootStructureName || '',
            autoLootContainerId: newActivity.data?.autoLootContainerId || null,
            autoLootContainerName: newActivity.data?.autoLootContainerName || '',
          }
          localStorage.setItem(salvagingPresetStorageKey, JSON.stringify(salvagingPreset))
        }

        if (newActivity.type === 'escalations') {
          const escalationsPreset = {
            space: newActivity.space,
            npcFaction: newActivity.data?.npcFaction,
            lastCargoState: newActivity.data?.lastCargoState,
          }
          localStorage.setItem(escalationsPresetStorageKey, JSON.stringify(escalationsPreset))
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
      toast.error(t('activity.startActivityNetworkError'))
    } finally {
      setIsLaunching(false)
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
        const result = await response.json()
        if (result.discarded) {
          removeActivity(id)
        } else {
          updateActivity(id, { status: 'completed', endTime: new Date() })
        }
      } else {
        toast.error(t('activity.endActivityError'))
      }
    } catch (error) {
      console.error('Error ending activity:', error)
      toast.error(t('activity.endActivityError'))
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
      } else {
        toast.error(t('activity.deleteActivityError'))
      }
    } catch (error) {
      console.error('Error deleting activity:', error)
      toast.error(t('activity.deleteActivityError'))
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
        toast.error(t('activity.premiumRequiredMultiCharacter'))
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

  const handleSelectActivityType = (typeId: string) => {
    const typeOption = ACTIVITY_TYPES.find((t) => t.id === typeId)
    if (typeOption?.comingSoon) return

    setNewActivity((prev) => ({
      ...prev,
      type: typeId as Activity['type'],
      region: undefined,
      data: {
        ...(prev.data || {}),
        siteName: undefined,
        siteType: undefined,
        miningType: undefined,
        npcFaction: undefined,
        lastCargoState: '',
      },
    }))
  }

  const completedActivities = useMemo(() => activities.filter((a) => a.status === 'completed'), [activities])
  const isRattingFactionRequired = newActivity.space !== 'Wormhole' && newActivity.space !== 'Pochven'
  const isRattingConfigurationReady = newActivity.type === 'ratting'
    && Boolean(newActivity.space)
    && Boolean(newActivity.data?.siteName)
    && (isRattingFactionRequired ? Boolean(newActivity.data?.npcFaction) : true)
  const markRattingConfigInteraction = () => {
    setRattingConfigInteractionCount((prev) => prev + 1)
  }
  const launchValidation = useMemo(() => validateLaunchActivityInput({
    type: newActivity.type,
    participants: newActivity.participants,
    space: newActivity.space,
    region: newActivity.region,
    data: (newActivity.data || {}) as Record<string, unknown>,
  }), [newActivity.type, newActivity.participants, newActivity.space, newActivity.region, newActivity.data])


  const currentTypeInfo = ACTIVITY_TYPES.find(t => t.id === typeParam)
  
  const totalQuantity = useMemo(
    () => activities.filter((a) => a.type === 'mining').reduce((sum, a) => sum + (Number(a.data?.totalQuantity) || 0), 0),
    [activities]
  )
  const activeGross = useMemo(
    () =>
      activeActivities.reduce(
        (sum, a) => sum + getActivityFinancialMetrics({ type: a.type, data: a.data }).gross,
        0
      ),
    [activeActivities]
  )
    
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
      
      const isCompleted = a.status === 'completed'
      const isPaused = a.isPaused
      
      let end: number
      if (isCompleted && a.endTime) {
        end = new Date(a.endTime).getTime()
      } else if (isPaused && a.pausedAt) {
        end = new Date(a.pausedAt).getTime()
      } else {
        end = new Date().getTime()
      }
      
      let duration = end - start
      if (a.accumulatedPausedTime) {
        duration -= a.accumulatedPausedTime
      }
      
      return sum + Math.max(0, duration)
    }, 0)
  }, [activities, mounted])

  return (
    <div
      className="mx-auto w-full max-w-[1600px] space-y-6 px-4 pb-20 md:px-8"
      data-tour="activity-tracker-page"
    >
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
            <h1 className="flex flex-wrap items-center gap-2 font-accent text-[22px] font-bold tracking-[0.01em] text-white sm:gap-3">
              {currentTypeInfo
                ? t('activity.tracker.title', { type: currentTypeInfo.label })
                : t('activity.tracker.titleDefault')}
              <Clock className="h-5 w-5 shrink-0 text-ta-muted" />
            </h1>
          </div>
          <p className="text-[12.5px] text-ta-muted">{t('global.trackFleetActivities')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          if (open && !canStartNewActivity) return
          setIsDialogOpen(open)
        }}>
          <div className="flex items-center gap-2">
            {typeParam === 'salvaging' && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-2 border-lime-500/30 text-lime-300 hover:bg-lime-500/10 sm:flex"
              >
                <Link href="/dashboard/analytics/salvaging">
                  <BarChart3 className="h-4 w-4" />
                  {t('activity.salvaging.intel.viewFullIntel')}
                </Link>
              </Button>
            )}
            {typeParam === 'ratting' && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-2 border-red-500/30 text-red-300 hover:bg-red-500/10 sm:flex"
              >
                <Link href="/dashboard/analytics/ratting">
                  <BarChart3 className="h-4 w-4" />
                  {t('activity.ratting.intel.viewFullIntel')}
                </Link>
              </Button>
            )}
            {typeParam === 'mining' && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-2 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 sm:flex"
              >
                <Link href="/dashboard/analytics/mining">
                  <BarChart3 className="h-4 w-4" />
                  {t('activity.mining.intel.viewFullIntel')}
                </Link>
              </Button>
            )}
            {typeParam === 'exploration' && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-2 border-amber-500/30 text-amber-300 hover:bg-amber-500/10 sm:flex"
              >
                <Link href="/dashboard/analytics/exploration">
                  <BarChart3 className="h-4 w-4" />
                  {t('activity.exploration.intel.viewFullIntel')}
                </Link>
              </Button>
            )}
            {typeParam === 'abyssal' && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className="hidden gap-2 border-violet-500/30 text-violet-300 hover:bg-violet-500/10 sm:flex"
              >
                <Link href="/dashboard/analytics/abyssal">
                  <BarChart3 className="h-4 w-4" />
                  {t('activity.abyssal.intel.viewFullIntel')}
                </Link>
              </Button>
            )}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 border border-zinc-800 bg-zinc-900/70 text-zinc-300 hover:text-white hover:bg-zinc-800/80"
                    onClick={() => window.dispatchEvent(new Event(ACTIVITY_TOUR_START_EVENT))}
                    aria-label={t('activity.tracker.restartTour')}
                    data-tour="restart-tour-button"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('activity.tracker.restartTour')}</TooltipContent>
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
                    {t('activity.startNew')}
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    {t('activity.premiumRequiredMultiActivity')}
                  </>
                )}
              </Button>
            </DialogTrigger>
          </div>
          <DialogContent className="max-h-[90vh] max-w-[min(100vw-2rem,56rem)] gap-0 overflow-y-auto border-eve-border/30 bg-[#050507] p-0 text-white shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <div className="bg-gradient-to-r from-eve-dark to-zinc-950 p-6 border-b border-eve-border/20">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <DialogTitle className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                      <div className="h-6 w-1 bg-eve-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(0,255,255,0.5)]" />
                      {t('activity.tracker.launch.title')}
                    </DialogTitle>
                    <DialogDescription className="text-xs font-medium text-zinc-500">
                      {t('activity.tracker.launch.description')}
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
                    {t('activity.tracker.launch.missionCategory')}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4" data-tour="activity-type-selector" role="radiogroup" aria-label={t('activity.tracker.launch.activityTypeAria')}>
                    {ACTIVITY_TYPES.map((type) => {
                      const globalConfig = moduleConfigs.find(c => c.module === type.id)
                      const isGloballyActive = globalConfig ? globalConfig.isActive : true
                      const hasAccess = canSelectActivityType(isGloballyActive)
                      const isComingSoon = !!type.comingSoon
                      const isSelected = newActivity.type === type.id
                      const isDisabled = !hasAccess || isComingSoon
                      return (
                        <button
                          key={type.id}
                          role="radio"
                          aria-checked={isSelected}
                          aria-disabled={isDisabled}
                          disabled={isDisabled}
                          onClick={() => handleSelectActivityType(type.id)}
                          data-tour={type.id === 'ratting' ? 'activity-type-ratting' : undefined}
                          className={cn(
                            "flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 gap-3 relative group",
                            isDisabled && "opacity-40 cursor-not-allowed grayscale",
                            isComingSoon && "opacity-50",
                            isSelected && !isComingSoon
                              ? "border-eve-accent bg-eve-accent/5 shadow-[0_0_20px_rgba(0,255,255,0.05)]" 
                              : "border-zinc-800/50 bg-zinc-900/30 hover:bg-zinc-800/50 hover:border-zinc-700",
                            isComingSoon && "hover:bg-zinc-900/30 hover:border-zinc-800/50"
                          )}
                        >
                          {isComingSoon && (
                            <span className="absolute top-1.5 right-1.5 rounded bg-zinc-800/90 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-wider text-zinc-400 border border-zinc-700/80">
                              {t('activity.tracker.launch.comingSoonBadge')}
                            </span>
                          )}
                          <div className="relative">
                            {(() => {
                              const ui = ACTIVITY_UI_MAPPING[type.id]
                              const Icon = ui?.icon
                              if (isComingSoon) {
                                return (
                                  <div className="relative">
                                    {Icon && <Icon className={cn("h-6 w-6 opacity-40", ui?.color)} />}
                                    <Clock className="h-3.5 w-3.5 text-zinc-500 absolute -top-1 -right-1" />
                                  </div>
                                )
                              }
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
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", isSelected && !isComingSoon ? "text-white" : "text-zinc-500 group-hover:text-zinc-400")}>{type.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Tactical Config */}
                <div className="space-y-6">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-zinc-500 flex items-center gap-2">
                    <Target className="h-3 w-3" />
                    {t('activity.tracker.launch.tacticalConfig')}
                  </Label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-950/50 p-6 rounded-2xl border border-zinc-900/50 backdrop-blur-sm" data-tour="ratting-config">
                    {newActivity.type !== 'abyssal' && (
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                          {t('activity.tracker.launch.securitySpace')}
                        </Label>
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
                            <SelectValue placeholder={t('activity.selectSpace')} />
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
                          <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">{t('activity.ratting.hostileFaction')}</Label>
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
                              <SelectValue placeholder={newActivity.space === 'Wormhole' ? 'Sleepers' : newActivity.space === 'Pochven' ? 'Triglavian' : t('activity.selectFaction')} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800"><ActivitySelectContentList items={NPC_FACTIONS} /></SelectContent>
                          </Select>
                        </div>
                        
                          <div className="space-y-2 col-span-1 sm:col-span-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                {t('activity.tracker.launch.detectedAnomalies', {
                                  faction:
                                    newActivity.data?.npcFaction ||
                                    t('activity.tracker.launch.awaitingFaction'),
                                })}
                              </Label>
                              <div className="flex items-center gap-2">
                                <ActivityTypeHelpTooltip activityType="ratting" />
                                {newActivity.data?.siteName && (
                                  <AnomaliesIntelDialog anomalyName={newActivity.data.siteName} />
                                )}
                              </div>
                            </div>
                            <Combobox
                              options={anomalies.map((a: any) => ({ value: a.name, label: a.name }))}
                              value={newActivity.data?.siteName || null}
                              onChange={(v) => {
                                markRattingConfigInteraction()
                                updateData({ siteName: v || undefined })
                              }}
                              placeholder={t('activity.ratting.selectAnomalyTarget')}
                              allowFreeText
                              allowClear
                              className="font-mono"
                            />
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
                              <SelectValue placeholder={t('activity.selectCategory')} />
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
                            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">Region</Label>
                            <Select
                              value={newActivity.region || ''}
                              onValueChange={(value) => setNewActivity((prev) => ({ ...prev, region: value }))}
                            >
                              <SelectTrigger className="h-10 bg-zinc-900 border-zinc-800 focus:ring-eve-accent/20">
                                <SelectValue placeholder={t('activity.selectRegion')} />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                <ActivitySelectContentList items={REGIONS} />
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                Initial Cargo State (Optional)
                              </Label>
                              <ActivityTypeHelpTooltip activityType="exploration" />
                            </div>
                            <Label className="text-[8px] text-eve-accent/50 animate-pulse">{t('global.criticalForLootDelta')}</Label>
                            <div className="relative group/cargo">
                              <textarea 
                                placeholder="PASTE CURRENT CARGO (Ctrl+A -> Ctrl+C in Inventory list view)..."
                                className="w-full h-24 p-3 bg-zinc-900/80 border-zinc-800 text-blue-400 placeholder:text-zinc-700 font-mono text-[10px] focus:ring-eve-accent/20 rounded-xl resize-none border transition-all hover:bg-zinc-900"
                                onChange={(e) => updateData({ lastCargoState: e.target.value })}
                                value={newActivity.data?.lastCargoState || ''}
                              />
                              <div className="absolute right-3 bottom-3 opacity-20 pointer-events-none">
                                <Box className="h-4 w-4 text-eve-accent" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {newActivity.type === 'salvaging' && (
                      <div className="space-y-4 col-span-1 sm:col-span-2">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                                {t('activity.salvaging.npcFaction')}
                              </Label>
                              <ActivityTypeHelpTooltip activityType="salvaging" />
                            </div>
                            <Select
                              value={newActivity.data?.npcFaction || ''}
                              onValueChange={(value) => updateData({ npcFaction: value })}
                            >
                              <SelectTrigger className="h-10 border-zinc-800 bg-zinc-900 focus:ring-lime-400/20">
                                <SelectValue placeholder={t('activity.selectFaction')} />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                <ActivitySelectContentList items={NPC_FACTIONS} />
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] text-zinc-400 font-bold uppercase tracking-tight">
                              {t('activity.salvaging.initialCargoOptional')}
                            </Label>
                            <Label className="text-[8px] text-lime-400/50 animate-pulse">{t('global.criticalForLootDelta')}</Label>
                            <div className="relative group/cargo">
                              <textarea
                                placeholder={t('activity.salvaging.initialCargoPlaceholder')}
                                className="w-full h-24 resize-none rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-[10px] text-lime-300 placeholder:text-zinc-700 transition-all hover:bg-zinc-900 focus:ring-lime-400/20"
                                onChange={(e) => updateData({ lastCargoState: e.target.value })}
                                value={newActivity.data?.lastCargoState || ''}
                              />
                              <div className="pointer-events-none absolute bottom-3 right-3 opacity-20">
                                <Box className="h-4 w-4 text-lime-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {newActivity.type === 'escalations' && (
                      <div className="col-span-1 space-y-4 sm:col-span-2">
                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                                {t('activity.escalations.npcFactionOptional')}
                              </Label>
                              <ActivityTypeHelpTooltip activityType="escalations" />
                            </div>
                            <Select
                              value={newActivity.data?.npcFaction || ''}
                              onValueChange={(value) => updateData({ npcFaction: value })}
                            >
                              <SelectTrigger className="h-10 border-zinc-800 bg-zinc-900 focus:ring-orange-400/20">
                                <SelectValue placeholder={t('activity.selectFaction')} />
                              </SelectTrigger>
                              <SelectContent className="bg-zinc-900 border-zinc-800">
                                <ActivitySelectContentList items={NPC_FACTIONS} />
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                              {t('activity.escalations.initialCargoOptional')}
                            </Label>
                            <Label className="text-[8px] animate-pulse text-orange-400/50">
                              {t('global.criticalForLootDelta')}
                            </Label>
                            <div className="group/cargo relative">
                              <textarea
                                placeholder={t('activity.escalations.initialCargoPlaceholder')}
                                className="h-24 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900/80 p-3 font-mono text-[10px] text-orange-300 placeholder:text-zinc-700 transition-all hover:bg-zinc-900 focus:ring-orange-400/20"
                                onChange={(e) => updateData({ lastCargoState: e.target.value })}
                                value={newActivity.data?.lastCargoState || ''}
                              />
                              <div className="pointer-events-none absolute bottom-3 right-3 opacity-20">
                                <Box className="h-4 w-4 text-orange-400" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {(['ratting', 'exploration', 'salvaging'] as const).includes(
                      (newActivity.type || '') as 'ratting' | 'exploration' | 'salvaging'
                    ) && (
                      <AutoLootTrackingPanel
                        featureEnabled={autoLootFeatureEnabled}
                        validation={autoLootContainerValidation}
                        characters={(session?.user?.characters || []).map((char) => ({
                          id: char.id,
                          name: char.name,
                        }))}
                        data={newActivity.data || {}}
                        onHelpClick={() => setShowAutoLootHelp(true)}
                        onChange={(patch) => {
                          if (newActivity.type === 'ratting') {
                            markRattingConfigInteraction()
                          }
                          updateData(patch)
                        }}
                      />
                    )}

                    {/* Placeholder for other types */}
                    {newActivity.type !== 'ratting' && newActivity.type !== 'mining' && newActivity.type !== 'abyssal' && newActivity.type !== 'exploration' && newActivity.type !== 'salvaging' && newActivity.type !== 'escalations' && (
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
                              <p className="text-zinc-500 font-bold mt-0.5">{participant?.fitName || participant?.fit || t('activity.noFitSelected')}</p>
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
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                      {t('activity.tracker.launch.preflight')}
                    </span>
                    {newActivity.participants && newActivity.participants.length > 0 ? (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-green-500">
                        <CheckCircle className="h-3 w-3" /> {t('activity.tracker.launch.ready')}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-red-500">
                        <XCircle className="h-3 w-3" /> {t('activity.tracker.launch.noCrew')}
                      </span>
                    )}
                  </div>
                  <div className="bg-zinc-900/50 rounded-xl p-4 space-y-2 border border-zinc-900/50">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-zinc-500">{t('activity.tracker.launch.operations')}</span>
                      <span className="font-bold text-white">{newActivity.type?.toUpperCase() || '—'}</span>
                    </div>
                    <div className="flex justify-between gap-2 text-[10px]">
                      <span className="shrink-0 text-zinc-500">{t('activity.tracker.launch.fleetStrength')}</span>
                      <span className="font-bold text-white">
                        {t('activity.tracker.launch.pilots', {
                          count: newActivity.participants?.length || 0,
                        })}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-[10px]">
                      <span className="shrink-0 text-zinc-500">{t('activity.tracker.launch.targeting')}</span>
                      <span className="min-w-0 flex-1 break-words text-right font-bold text-eve-accent">
                        {newActivity.type === 'mining'
                          ? newActivity.data?.miningType || t('activity.unassigned')
                          : newActivity.type === 'ratting'
                            ? newActivity.data?.siteName || t('activity.unassigned')
                            : newActivity.type === 'exploration'
                              ? newActivity.region || t('activity.unassigned')
                              : newActivity.type === 'salvaging'
                                ? newActivity.data?.npcFaction || t('activity.unassigned')
                              : newActivity.type === 'escalations'
                                ? newActivity.data?.npcFaction || t('activity.unassigned')
                              : newActivity.type === 'abyssal'
                                ? (newActivity.data?.lastCargoState ? t('activity.cargoReady') : t('activity.unassigned'))
                                : t('activity.unassigned')}
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
                {t('activity.abortMission')}
              </Button>
              <Button
                onClick={handleStartActivity}
                disabled={isLaunching}
                className={cn(
                  "font-black uppercase text-xs tracking-widest px-8 py-6 rounded-xl transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 h-auto",
                  launchValidation.isValid
                    ? "bg-eve-accent text-black hover:bg-eve-accent/80 shadow-[0_0_30px_rgba(0,255,255,0.2)]"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                )}
                data-tour="launch-fleet-operations"
              >
                {isLaunching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2 fill-current" />}
                {isLaunching ? t('activity.launching') : t('activity.launchFleetOperations')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ActivityStatsPanel
        paginationTotal={pagination.total}
        paginationActiveCount={pagination.activeCount}
        totalDuration={mounted ? formatDuration(totalDuration) : '--h --m'}
        activeCount={activeActivities.length}
        typeParam={typeParam}
        totalQuantity={totalQuantity}
        activeGross={activeGross}
      />

      <ActiveOperationsPanel
        activeActivities={activeActivities}
        tourCreatedActivityId={tourCreatedActivityId}
        noActiveOperationsText={t('global.noActiveOperations')}
        launchNewActivityText={t('global.launchNewActivity')}
        onEndActivity={handleEndActivity}
      />

      <TrackerHealthPanel
        isLoading={isLoading}
        lastError={lastError}
        lastFetchAt={lastFetchAt}
        lastSyncAt={lastSyncAt}
        loadingLabel={t('activity.refreshingActivityData')}
        fallbackErrorLabel={t('activity.trackerError')}
        lastLoadLabel={t('activity.lastLoad')}
        lastSyncLabel={t('activity.lastSync')}
        unknownTimestampLabel={t('common.unknown')}
      />

      <OperationHistoryPanel
        completedActivities={completedActivities}
        pagination={pagination}
        historyPageLimit={historyPageLimit}
        setHistoryPageLimit={setHistoryPageLimit}
        typeParam={typeParam ?? undefined}
        loading={isLoading}
        title={t('common.operationHistory')}
        recordsText={t('common.records')}
        noOperationText={t('common.noOperation')}
        startActivityHintText={t('common.startActivityHint')}
        loadingText={t('activity.loadingHistory')}
        onDelete={handleDeleteActivity}
        onOpenDetail={handleOpenHistoryDetail}
        onFetchPage={(type, page, limit) => {
          void fetchFromAPI(type, page, limit)
        }}
      />

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
          {t('activity.loadingHistoryDetails')}
        </div>
      )}

      <Dialog open={showAutoLootHelp} onOpenChange={setShowAutoLootHelp}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm uppercase tracking-wider">
              {t('activity.tracker.launch.autoLootTracking')}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-400">
              {t('activity.autoLootHelpDescription')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs text-zinc-300">
            <p>- {t('activity.autoLootHelpBullet1')}</p>
            <p>- {t('activity.autoLootHelpBullet2')}</p>
            <p>- {t('activity.autoLootHelpBullet3')}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
