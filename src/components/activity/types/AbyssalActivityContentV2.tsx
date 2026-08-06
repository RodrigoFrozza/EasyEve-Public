'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatISK, cn, formatNumber, formatCurrencyValue } from '@/lib/utils'
import { useActivityStore } from '@/lib/stores/activity-store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { ActivityCardFooter } from '../shared/ActivityCardFooter'
import { ActivityAnalyticsDialog } from '../analytics/ActivityAnalyticsDialog'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { AbyssalLootModal, ConfirmEndModal, AbyssalRunDetailModal } from '../modals'
import {
  BellRing,
  Clock3,
  Gauge,
  MapPin,
  Play,
  Square,
  Timer,
  Wallet,
  Trash2,
  Loader2,
  Pencil,
  Package,
  ChevronRight,
  HelpCircle,
  ChevronDown,
  Settings2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { calculateAbyssalDelta } from '@/lib/parsers/eve-cargo-parser'
import { getMarketAppraisalWithIds } from '@/lib/market'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { isInsideAbyss } from '@/lib/activities/abyssal-detection'
import {
  findTargetPendingRun,
  getAbyssalSessionMetrics,
} from '@/lib/activities/abyssal-metrics'
import { getAbyssalRunDefaults } from '@/lib/activities/abyssal-defaults'
import { buildAbyssalLootContents } from '@/lib/activities/abyssal-loot-contents'
import { getSessionHours } from '@/lib/activities/session-kpis'
import { ActivityLogPanel, ActivityThemedPanel } from '../shared/ActivityThemedPanel'
import {
  ActivityCardBody,
  ActivityCardMainSlot,
  ActivityMetricsGrid,
  ActivityParticipantsRow,
} from '../shared/activity-card-layout'

type TrackingMode = 'automatic' | 'manual'

interface AbyssalRun {
  id: string
  startTime: string
  endTime?: string
  status: 'active' | 'completed' | 'death'
  registrationStatus?: 'pending' | 'registered' | 'not_registered'
  tier?: string
  weather?: string
  ship?: string
  lootValue?: number
  note?: string
  lootItems?: Array<{
    name: string
    quantity: number
    value?: number
    typeId?: number
    id?: number
  }>
  consumedItems?: Array<{ name: string; quantity: number; value?: number; typeId?: number; id?: number }>
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
  const { t } = useTranslations()
  const [mounted, setMounted] = useState(false)
  const [lootModalOpen, setLootModalOpen] = useState(false)
  const [confirmEndOpen, setConfirmEndOpen] = useState(false)
  const [detailModalOpen, setDetailModalOpen] = useState(false)
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [editingRunId, setEditingRunId] = useState<string | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const registrationRef = useRef<HTMLDivElement>(null)
  const afterTextRef = useRef<HTMLTextAreaElement>(null)

  // Registration Form State
  const [beforeText, setBeforeText] = useState(activity.data?.lastCargoState || '')
  const [afterText, setAfterText] = useState('')
  const [tier, setTier] = useState(activity.data?.lastRunDefaults?.tier || 'T6 (Cataclysmic)')
  const [weather, setWeather] = useState(activity.data?.lastRunDefaults?.weather || 'Electrical')
  const [ship, setShip] = useState(activity.data?.lastRunDefaults?.ship || 'Undefined')
  const [preview, setPreview] = useState<{ loot: any[], consumed: any[], netValue: number } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isBeforeCargoEditable, setIsBeforeCargoEditable] = useState(false)
  const [beforeCargoSectionOpen, setBeforeCargoSectionOpen] = useState(false)
  const [previewDetailsOpen, setPreviewDetailsOpen] = useState(false)

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
  const historyRuns = useMemo(
    () => runs.filter((run) => run.status !== 'active'),
    [runs]
  )
  const sessionHours = useMemo(() => getSessionHours(activity), [activity])
  const abyssalMetrics = useMemo(
    () => getAbyssalSessionMetrics(runs, sessionHours),
    [runs, sessionHours]
  )
  const [lootModalSeed, setLootModalSeed] = useState(0)
  const [lastEndedRunId, setLastEndedRunId] = useState<string | null>(null)
  const [lootModalSnapshot, setLootModalSnapshot] = useState<{
    beforeText: string
    afterText: string
    tier: string
    weather: string
    ship: string
  } | null>(null)

  useEffect(() => {
    if (!lootModalOpen) return
    setLootModalSeed((seed) => seed + 1)
    const targetRun = editingRunId
      ? runs.find((run) => run.id === editingRunId)
      : findTargetPendingRun(runs, lastEndedRunId)
    const defaults = getAbyssalRunDefaults(activity.data?.lastRunDefaults)
    setLootModalSnapshot({
      beforeText:
        targetRun?.beforeCargoState ||
        activity.data?.lastCargoState ||
        '',
      tier: targetRun?.tier || defaults.tier,
      weather: targetRun?.weather || defaults.weather,
      ship: targetRun?.ship || defaults.ship,
      afterText: targetRun?.afterCargoState || '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot only when modal opens
  }, [lootModalOpen])

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

  useEffect(() => {
    if (!preview) setPreviewDetailsOpen(false)
  }, [preview])

  const persistData = useCallback(
    async (nextData: any, options?: { touchRuns?: boolean; deletedRunIds?: string[] }) => {
      const payload = options?.touchRuns
        ? { ...nextData, lastDataAt: new Date().toISOString() }
        : nextData

      setLocalIsSyncing(true)
      useActivityStore.getState().updateActivity(activity.id, { data: payload })

      try {
        const response = await fetch(`/api/activities/${activity.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: payload, deletedRunIds: options?.deletedRunIds }),
        })

        if (!response.ok) {
          throw new Error(`Sync failed: ${response.status}`)
        }

        const updated = await response.json()
        if (updated?.discarded) {
          return updated
        }
        if (updated?.data) {
          useActivityStore.getState().updateActivity(activity.id, { data: updated.data })
        }
        return updated
      } catch (err) {
        console.error('[AbyssalSync] Error:', err)
        toast.error(t('activity.abyssal.syncError'), {
          description: t('activity.abyssal.syncErrorDescription'),
        })
        return null
      } finally {
        setLocalIsSyncing(false)
      }
    },
    [activity.id, t]
  )

  const startRun = useCallback(() => {
    if (activeRun) return

    const defaults = getAbyssalRunDefaults(activity.data?.lastRunDefaults)
    const initialCargo = activity.data?.lastCargoState || ''

    const newRun: AbyssalRun = {
      id: crypto.randomUUID(),
      startTime: new Date().toISOString(),
      status: 'active',
      registrationStatus: 'pending',
      tier: defaults.tier,
      weather: defaults.weather,
      ship: defaults.ship,
      lootValue: 0,
      beforeCargoState: initialCargo,
    }

    persistData(
      {
        ...activity.data,
        trackingMode,
        runs: [...runs, newRun],
      },
      { touchRuns: true }
    )
  }, [activeRun, activity.data, persistData, runs, trackingMode])

  const handleDeleteRun = useCallback((runId: string) => {
    const updatedRuns = runs.filter((r) => r.id !== runId)
    const totalLootValue = updatedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)

    if (selectedRunId === runId) {
      setDetailModalOpen(false)
      setSelectedRunId(null)
    }

    persistData(
      {
        ...activity.data,
        runs: updatedRuns,
        lootValue: totalLootValue,
        totalLootValue,
        lootContents: buildAbyssalLootContents(updatedRuns),
        logs: (activity.data?.logs || []).filter((l: { runId?: string }) => l.runId !== runId),
      },
      { touchRuns: true, deletedRunIds: [runId] }
    )

    toast.info(t('activity.abyssal.runDeleted'), {
      description: t('activity.abyssal.runDeletedDescription'),
    })
  }, [activity.data, persistData, runs, selectedRunId, t])

  const confirmDeleteRun = useCallback(
    (runId: string) => {
      toast(t('common.deleteConfirmTitle'), {
        description: t('common.deleteConfirmDesc'),
        action: {
          label: t('common.delete'),
          onClick: () => void handleDeleteRun(runId),
        },
        cancel: {
          label: t('common.cancel'),
          onClick: () => {},
        },
        duration: 8000,
      })
    },
    [handleDeleteRun, t],
  )

  const endActiveRun = useCallback(() => {
    if (!activeRun) return

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

    setLastEndedRunId(activeRun.id)

    void persistData(
      {
        ...activity.data,
        runs: finishedRuns,
      },
      { touchRuns: true }
    ).then(() => {
      setLootModalOpen(true)
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

    const totalLootValue = deadRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)

    persistData(
      {
        ...activity.data,
        runs: deadRuns,
        lootValue: totalLootValue,
        totalLootValue,
      },
      { touchRuns: true }
    )

    toast.error(t('activity.abyssal.deathRecorded'), {
      description: t('activity.abyssal.deathRecordedDescription'),
    })
  }, [activeRun, activity.data, persistData, runs, t])

  const confirmDeath = useCallback(() => {
    toast(t('activity.abyssal.confirmDeathTitle'), {
      description: t('activity.abyssal.confirmDeathDesc'),
      action: {
        label: t('common.confirm'),
        onClick: () => void handleDeath(),
      },
      cancel: {
        label: t('common.cancel'),
        onClick: () => {},
      },
      duration: 8000,
    })
  }, [handleDeath, t])

  const saveAbyssalRegistration = useCallback(
    (payload: {
      lootItems: Array<{ name: string; quantity: number; value?: number; id?: number; typeId?: number }>
      consumedItems: Array<{ name: string; quantity: number; value?: number; id?: number; typeId?: number }>
      netValue: number
      beforeCargoState: string
      afterCargoState: string
      tier: string
      weather: string
      ship: string
    }) => {
      if (activeRun && !editingRunId) {
        toast.info(t('activity.abyssal.activeRunLocking'))
        return
      }

      const mapItemsWithTypeId = <T extends { id?: number; typeId?: number }>(items: T[]) =>
        items.map((item) => ({
          ...item,
          typeId: item.typeId ?? item.id ?? 0,
        }))

      const lootItems = mapItemsWithTypeId(payload.lootItems)
      const consumedItems = mapItemsWithTypeId(payload.consumedItems)

      let targetRunId = editingRunId
      let startTime = new Date().toISOString()
      let endTime = new Date().toISOString()

      if (editingRunId) {
        const existing = runs.find((r) => r.id === editingRunId)
        startTime = existing?.startTime || startTime
        endTime = existing?.endTime || endTime
      } else {
        const pendingRun = findTargetPendingRun(runs, lastEndedRunId)
        if (pendingRun) {
          targetRunId = pendingRun.id
          startTime = pendingRun.startTime || startTime
          endTime = pendingRun.endTime || endTime
        }
      }

      const newRun: AbyssalRun = {
        id: targetRunId || crypto.randomUUID(),
        startTime,
        endTime,
        status: 'completed',
        tier: payload.tier,
        weather: payload.weather,
        ship: payload.ship,
        lootItems,
        consumedItems,
        lootValue: payload.netValue,
        registrationStatus: 'registered' as const,
        beforeCargoState: payload.beforeCargoState,
        afterCargoState: payload.afterCargoState,
        editable: true,
      }

      let updatedRuns: AbyssalRun[] = []
      if (editingRunId || targetRunId) {
        const id = editingRunId || targetRunId!
        updatedRuns = runs.some((r) => r.id === id)
          ? runs.map((r) => (r.id === id ? newRun : r))
          : [...runs, newRun]
      } else {
        updatedRuns = [...runs, newRun]
      }

      const totalLootValue = updatedRuns.reduce((sum, run) => sum + (run.lootValue || 0), 0)
      const lootContents = buildAbyssalLootContents(updatedRuns)
      const newLogEntry = {
        refId: crypto.randomUUID(),
        date: new Date().toISOString(),
        amount: payload.netValue,
        type: 'loot',
        charId: characterId,
        charName: characterName,
        items: lootItems,
        consumed: consumedItems,
        runId: newRun.id,
      }

      persistData(
        {
        ...activity.data,
        runs: updatedRuns,
        logs: [
          newLogEntry,
          ...((activity.data?.logs || []) as Array<{ runId?: string }>).filter(
            (l) => l.runId !== newRun.id,
          ),
        ],
        lootValue: totalLootValue,
        totalLootValue,
        lootContents,
        lastCargoState: payload.afterCargoState,
        lastRunDefaults: {
          tier: payload.tier,
          weather: payload.weather,
          ship: payload.ship,
        },
      },
        { touchRuns: true }
      )

      setEditingRunId(null)
      setLastEndedRunId(null)
      // Reset local states for the next run - VITAL: afterText must be cleared and beforeText promoted
      setBeforeText(payload.afterCargoState)
      setAfterText('')
      setPreview(null)
      
      setLootModalOpen(false)
      toast.success(t('activity.abyssal.lootRegistration'), {
        description: t('activity.abyssal.runRegistered'),
      })
    },
    [
      activeRun,
      activity.data,
      characterId,
      characterName,
      editingRunId,
      lastEndedRunId,
      persistData,
      runs,
      t,
    ]
  )

  const openLootModal = useCallback(() => {
    if (activeRun && !editingRunId) {
      toast.info(t('activity.abyssal.activeRunLocking'))
      return
    }
    setLootModalOpen(true)
  }, [activeRun, editingRunId, t])

  const openRegisterForRun = useCallback((runId: string) => {
    setEditingRunId(runId)
    setLootModalOpen(true)
  }, [])

  const focusRegistration = useCallback(() => {
    if (displayMode === 'compact') {
      openLootModal()
      return
    }
    registrationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    window.setTimeout(() => afterTextRef.current?.focus(), 350)
  }, [displayMode, openLootModal])

  const handleExport = useCallback(() => {
    if (historyRuns.length === 0) {
      toast.info(t('activity.abyssal.exportNoRuns'))
      return
    }
    const headers = ['Start', 'End', 'Tier', 'Weather', 'Ship', 'Status', 'ISK']
    const rows = historyRuns.map((run) => {
      const start = new Date(run.startTime).toISOString()
      const end = run.endTime ? new Date(run.endTime).toISOString() : ''
      return [
        start,
        end,
        run.tier || '',
        run.weather || '',
        run.ship || '',
        run.status,
        String(Math.round(run.lootValue || 0)),
      ].join(',')
    })
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    })
    const link = document.createElement('a')
    const objectUrl = URL.createObjectURL(blob)
    link.href = objectUrl
    link.download = `abyssal_${activity.id}_${Date.now()}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(objectUrl)
  }, [activity.id, historyRuns, t])

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
    if (
      !mounted ||
      !characterId ||
      activity.status === 'completed' ||
      isPaused ||
      trackingMode === 'manual'
    ) {
      return
    }

    let pollTimer: NodeJS.Timeout
    let currentDelay = 15000
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      setIsPollingLocation(true)
      try {
        const response = await fetch(`/api/characters/${characterId}/location`)
        if (cancelled) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMsg = errorData.error || `Error ${response.status}`
          setLocationError(errorMsg)
          currentDelay = Math.min(currentDelay * 2, 300000)
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
        currentDelay = 15000

        const insideAbyssDetected = isInsideAbyss(location, solarSystemId)

        if (trackingMode === 'automatic') {
          if (cancelled) return
          if (insideAbyssDetected && !activeRun) startRun()
          if (cancelled) return
          if (!insideAbyssDetected && activeRun) endActiveRun()
        }

        if (!cancelled) {
          pollTimer = setTimeout(poll, currentDelay)
        }
      } catch (err) {
        if (cancelled) return
        console.error('[LocationPoll] Error:', err)
        setLocationError('Connection failed')
        currentDelay = Math.min(currentDelay * 2, 300000)
        pollTimer = setTimeout(poll, currentDelay)
      } finally {
        if (!cancelled) setIsPollingLocation(false)
      }
    }

    poll()

    return () => {
      cancelled = true
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [
    mounted,
    characterId,
    activity.status,
    trackingMode,
    activeRun,
    startRun,
    endActiveRun,
    isPaused,
  ])

  const { totalFilaments, totalIsk, bestRunValue, iskPerHour, pendingCount } = abyssalMetrics
  const insideAbyssNow = isInsideAbyss(currentLocation, currentSolarSystemId)

  const isModuleSyncing = isSyncing || localIsSyncing
  const theme = getActivityTheme('abyssal')
  const metricCardShell = cn(
    theme.metricShell,
    'flex flex-col gap-1 hover:border-purple-400/45 hover:bg-purple-500/[0.14]'
  )

  const statProps = {
    size: 'compact' as const,
    labelClassName: theme.textMuted,
    subValueClassName: theme.textMuted,
    valueClassName: theme.text,
  }

  const purpleFieldClass = cn(
    'rounded-lg border border-purple-400/25 bg-black/30 backdrop-blur-sm',
    'text-purple-50 focus-visible:ring-1 focus-visible:ring-purple-400/35'
  )

  const purpleTextareaClass = cn(
    purpleFieldClass,
    'font-mono text-[10px] leading-relaxed'
  )

  const headerActionClass = cn(
    'h-9 w-9 rounded-lg border backdrop-blur-sm transition-colors',
    'border-purple-400/30 bg-purple-500/15 text-purple-200/90',
    'hover:border-purple-400/50 hover:bg-purple-500/25 hover:text-purple-100'
  )

  const filamentSub =
    totalFilaments === 0 ? t('activity.abyssal.noRunsYet') : t('activity.abyssal.runsUnit')
  const totalIskSub =
    totalIsk === 0 ? t('activity.abyssal.registerFirstRun') : 'isk'
  const bestRunSub =
    bestRunValue === 0 ? t('activity.abyssal.metricsAwaiting') : 'isk'
  const iskHourSub =
    iskPerHour === 0 ? t('activity.abyssal.metricsAwaiting') : 'isk/h'

  const recentRuns = useMemo(
    () =>
      [...historyRuns]
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, displayMode === 'compact' ? 3 : 12),
    [historyRuns, displayMode]
  )

  const lootModalInitialData = lootModalSnapshot || {
    beforeText: activity.data?.lastCargoState || '',
    afterText: '',
    ...getAbyssalRunDefaults(activity.data?.lastRunDefaults),
  }

  if (!mounted) return null

  const renderHistoryRun = (run: AbyssalRun) => {
    const durationMin = run.endTime
      ? Math.round(
          (new Date(run.endTime).getTime() - new Date(run.startTime).getTime()) / 60000
        )
      : 0
    const statusLabel =
      run.status === 'death'
        ? t('activity.abyssal.runDeath')
        : run.registrationStatus === 'pending'
          ? t('activity.abyssal.runPending')
          : run.registrationStatus === 'not_registered'
            ? t('activity.abyssal.runNotRegistered')
            : t('activity.abyssal.runRegistered')

    return (
      <button
        type="button"
        onClick={() => {
          setSelectedRunId(run.id)
          setDetailModalOpen(true)
        }}
        className={cn(
          'group/history flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
          theme.historyRow,
          theme.historyRowHover
        )}
      >
        <div className="min-w-0 flex-1">
          <p className={cn('truncate text-xs font-semibold', theme.text)}>
            {run.tier || '—'} · {run.weather || '—'}
          </p>
          <p className={cn('mt-0.5 text-[10px]', theme.textMuted)}>
            {durationMin}m · {statusLabel}
            {run.ship ? ` · ${run.ship}` : ''}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {run.registrationStatus === 'pending' && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 rounded-md border-amber-400/30 bg-amber-500/10 px-2 text-[10px] font-bold uppercase text-amber-200 hover:bg-amber-500/20"
              onClick={(event) => {
                event.stopPropagation()
                openRegisterForRun(run.id)
              }}
            >
              {t('activity.abyssal.registerRun')}
            </Button>
          )}
          <span
            className={cn(
              'text-sm font-bold tabular-nums',
              run.lootValue && run.lootValue > 0 ? theme.revenuePositive : theme.textMuted
            )}
          >
            {formatISK(run.lootValue || 0)}
          </span>
          <ChevronRight
            className={cn('h-4 w-4 opacity-40 group-hover/history:opacity-100', theme.chevron)}
          />
        </div>
      </button>
    )
  }

  const locationDisplay = currentLocation
    ? isInsideAbyss(currentLocation, currentSolarSystemId)
      ? `${t('activity.abyssal.insideAbyss')} (${currentLocation})`
      : currentLocation
    : isPollingLocation
      ? t('activity.abyssal.detectingLocation')
      : locationError
        ? locationError
        : '—'

  const packageTooltip =
    displayMode === 'compact'
      ? t('activity.abyssal.registerLoot')
      : t('activity.abyssal.scrollToRegister')

  const participantsRow = (
    <ActivityParticipantsRow>
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2 hover:space-x-1 transition-all duration-500">
            {(activity.participants || []).map((participant: any) => (
              <Tooltip key={participant.characterId}>
                <TooltipTrigger asChild>
                  <Avatar
                    className={cn(
                      'h-9 w-9 rounded-lg ring-1 ring-white/10 transition-none',
                      theme.iconBg
                    )}
                  >
                    <AvatarImage
                      src={`https://images.evetech.net/characters/${participant.characterId}/portrait?size=64`}
                      className="rounded-lg"
                    />
                    <AvatarFallback className="rounded-lg">
                      {participant.characterName?.[0] || 'A'}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent className="rounded-lg border border-purple-400/25 bg-[#0c141c]/95 text-xs text-purple-100">
                  {participant.characterName}
                </TooltipContent>
              </Tooltip>
            ))}
          </div>

          <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />

          {pendingCount > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-amber-400/35 bg-amber-500/15 px-1.5 text-[10px] font-bold tabular-nums text-amber-200">
              {pendingCount}
            </span>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={headerActionClass}
                onClick={focusRegistration}
              >
                <Package className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg border border-purple-400/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-purple-100">
              {packageTooltip}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={headerActionClass}
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent('open-abyssal-config', {
                      detail: { activityId: activity.id },
                    })
                  )
                }
              >
                <Settings2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg border border-purple-400/25 bg-[#0c141c]/95 text-[10px] font-bold uppercase tracking-wide text-purple-100">
              {t('activity.abyssal.configuration')}
            </TooltipContent>
          </Tooltip>
        </div>

        <div
          className={cn(
            'inline-flex gap-1 rounded-lg border p-1 backdrop-blur-sm',
            'border-purple-400/20 bg-black/25'
          )}
        >
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
              trackingMode === 'automatic' ? theme.chipActive : 'text-purple-300/50 hover:text-purple-100'
            )}
            onClick={() => persistData({ ...activity.data, trackingMode: 'automatic' as TrackingMode })}
          >
            {t('activity.abyssal.automatic')}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              'h-7 rounded-md px-2 text-[10px] font-bold uppercase tracking-wide transition-colors',
              trackingMode === 'manual' ? theme.chipActive : 'text-purple-300/50 hover:text-purple-100'
            )}
            onClick={() => persistData({ ...activity.data, trackingMode: 'manual' as TrackingMode })}
          >
            {t('activity.abyssal.manual')}
          </Button>
        </div>
      </ActivityParticipantsRow>
  )

  const metricsGrid = (
    <ActivityMetricsGrid>
        <ActivityStatDisplay
          label={t('activity.abyssal.filament')}
          value={totalFilaments}
          subValue={filamentSub}
          {...statProps}
          icon={<Gauge className={cn('h-3 w-3', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.abyssal.totalIsk')}
          value={formatCurrencyValue(totalIsk)}
          subValue={totalIskSub}
          {...statProps}
          icon={<Wallet className={cn('h-3 w-3', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.abyssal.bestRun')}
          value={formatCurrencyValue(bestRunValue)}
          subValue={bestRunSub}
          {...statProps}
          icon={<BellRing className={cn('h-3 w-3', theme.text)} />}
          className={metricCardShell}
        />
        <ActivityStatDisplay
          label={t('activity.abyssal.iskPerHour')}
          value={formatCurrencyValue(iskPerHour)}
          subValue={iskHourSub}
          {...statProps}
          icon={<Clock3 className={cn('h-3 w-3', theme.text)} />}
          className={cn(metricCardShell, 'cursor-pointer hover:border-purple-400/50')}
          title={t('activity.analytics.viewIndicators')}
          onClick={() => setAnalyticsOpen(true)}
        />
    </ActivityMetricsGrid>
  )

  const historySection = (
    <ActivityLogPanel
      theme={theme}
      logName={
        displayMode === 'compact'
          ? t('activity.abyssal.recentRuns')
          : t('activity.abyssal.runHistory')
      }
      emptyMessage={t('activity.abyssal.historyEmpty')}
      emptyHint={t('activity.abyssal.logEmptyHint')}
      isEmpty={recentRuns.length === 0}
    >
      <ul className="space-y-1.5 p-0.5">
        {recentRuns.map((run) => (
          <li key={run.id} className="group/row flex items-stretch gap-0.5">
            <div className="min-w-0 flex-1">{renderHistoryRun(run)}</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 self-center text-purple-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/row:opacity-100"
              onClick={() => confirmDeleteRun(run.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    </ActivityLogPanel>
  )

  const abyssalModals = (
    <>
      <AbyssalLootModal
        open={lootModalOpen}
        onOpenChange={(open) => {
          setLootModalOpen(open)
          if (!open) setEditingRunId(null)
        }}
        onSave={saveAbyssalRegistration}
        initialData={lootModalInitialData}
        lastCargoState={activity.data?.lastCargoState}
        defaultTier={activity.data?.lastRunDefaults?.tier}
        defaultWeather={activity.data?.lastRunDefaults?.weather}
        defaultShip={activity.data?.lastRunDefaults?.ship}
      />

      <AbyssalRunDetailModal
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        run={runs.find((r) => r.id === selectedRunId) || null}
        onRegisterLoot={(runId) => {
          setDetailModalOpen(false)
          openRegisterForRun(runId)
        }}
      />

      <ActivityAnalyticsDialog
        open={analyticsOpen}
        onOpenChange={setAnalyticsOpen}
        activity={activity}
      />

      <ConfirmEndModal
        open={confirmEndOpen}
        onOpenChange={setConfirmEndOpen}
        pendingCount={pendingCount + (activeRun ? 1 : 0)}
        onRegisterFirst={() => {
          setConfirmEndOpen(false)
          if (activeRun) {
            void endActiveRun()
          } else if (pendingCount > 0) {
            const pendingRun = findTargetPendingRun(runs, lastEndedRunId)
            if (pendingRun?.id) openRegisterForRun(pendingRun.id)
            else openLootModal()
          } else {
            openLootModal()
          }
        }}
        onConfirm={async () => {
          setConfirmEndOpen(false)
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
            await persistData(
              { ...activity.data, runs: finishedRuns },
              { touchRuns: true }
            )
          }
          onEnd?.()
        }}
      />
    </>
  )

  const compactTimerStrip = (
    <ActivityThemedPanel theme={theme} title={t('activity.abyssal.compactTimerTitle')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className={cn('h-4 w-4 shrink-0', theme.text)} />
          <span className={cn('font-mono text-lg font-black tabular-nums leading-none', theme.text)}>
            {timeLeft}
          </span>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide',
            insideAbyssNow
              ? 'border-red-400/30 bg-red-500/10 text-red-200'
              : 'border-purple-400/25 bg-purple-500/10 text-purple-200/90'
          )}
        >
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              insideAbyssNow ? 'animate-pulse bg-red-400' : 'bg-purple-400'
            )}
          />
          {insideAbyssNow ? t('activity.abyssal.statusInside') : t('activity.abyssal.statusOutside')}
        </span>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px]">
            <MapPin
              className={cn(
                'h-3 w-3 shrink-0',
                insideAbyssNow ? 'text-red-400' : 'text-emerald-400'
              )}
            />
            <span
              className={cn(
                'truncate',
                insideAbyssNow ? 'text-red-300/90' : theme.textMuted
              )}
            >
              {locationDisplay}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs rounded-lg border border-purple-400/25 bg-[#0c141c]/95 text-xs text-purple-100">
          {locationDisplay}
        </TooltipContent>
      </Tooltip>

      {pendingCount > 0 && (
        <p className="mt-2 text-[10px] leading-snug text-amber-200/85">
          {t('activity.abyssal.runFinishedLootPending', { count: pendingCount })}
        </p>
      )}

      {activeRun && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={confirmDeath}
          className="mt-2 flex h-7 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
          {t('activity.abyssal.reportDeath')}
        </Button>
      )}

      {trackingMode === 'manual' && (
        <Button
          type="button"
          className={cn(
            'mt-2 h-8 w-full rounded-lg border text-[10px] font-medium transition-colors',
            activeRun
              ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
          )}
          onClick={() => (activeRun ? endActiveRun() : startRun())}
        >
          {activeRun ? <Square className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          {activeRun ? t('activity.abyssal.stopTimer') : t('activity.abyssal.startTimer')}
        </Button>
      )}

      <Button
        type="button"
        disabled={trackingMode === 'automatic' && insideAbyssNow}
        className={cn(
          'mt-3 h-9 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
          trackingMode === 'automatic' && insideAbyssNow
            ? 'border-purple-400/15 bg-black/20 text-purple-300/40'
            : 'border-purple-300/50 bg-purple-500 text-white shadow-[0_0_24px_-8px_rgba(168,85,247,0.5)] hover:bg-purple-400'
        )}
        onClick={openLootModal}
      >
        {trackingMode === 'automatic' && insideAbyssNow
          ? t('activity.abyssal.activeRunLocking')
          : t('activity.abyssal.compactRegisterCta')}
      </Button>
    </ActivityThemedPanel>
  )

  if (displayMode === 'compact') {
    return (
      <ActivityCardBody>
        {participantsRow}
        {metricsGrid}
        <ActivityCardMainSlot>{compactTimerStrip}</ActivityCardMainSlot>
        {historySection}
        <ActivityCardFooter
          activityType="abyssal"
          mode="compact"
          onSync={onSync}
          isSyncing={isSyncing}
          syncStatus={syncStatus}
          onTogglePause={onTogglePause!}
          isPaused={isPaused!}
          onEnd={() => setConfirmEndOpen(true)}
          onExport={handleExport}
        />
        {abyssalModals}
      </ActivityCardBody>
    )
  }

  const hasSavedBeforeCargo = Boolean(activity.data?.lastCargoState?.trim())
  const showCollapsedBeforeCargo =
    hasSavedBeforeCargo && !beforeCargoSectionOpen && !isBeforeCargoEditable
  const previewItemCount =
    (preview?.loot.length ?? 0) + (preview?.consumed.length ?? 0)

  const expandedStatusChip = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold uppercase tracking-wide',
        insideAbyssNow
          ? 'border-red-400/30 bg-red-500/10 text-red-200'
          : 'border-purple-400/25 bg-purple-500/10 text-purple-200/90'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          insideAbyssNow ? 'animate-pulse bg-red-400' : 'bg-purple-400'
        )}
      />
      {insideAbyssNow ? t('activity.abyssal.statusInside') : t('activity.abyssal.statusOutside')}
    </span>
  )

  const registrationHelpTooltip = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-purple-300/60 hover:bg-purple-500/15 hover:text-purple-100"
        >
          <HelpCircle className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] space-y-2 rounded-lg border border-purple-400/25 bg-[#0c141c]/95 p-3 text-xs leading-relaxed text-purple-100/90">
        {pendingCount > 0 ? (
          <p>{t('activity.abyssal.runFinishedLootPending', { count: pendingCount })}</p>
        ) : null}
        <p>{t('global.inGameCargoInstructions')}</p>
      </TooltipContent>
    </Tooltip>
  )

  return (
    <ActivityCardBody>
      {participantsRow}

      {metricsGrid}

      <ActivityCardMainSlot>
      <ActivityThemedPanel theme={theme} title={t('activity.abyssal.timerPanel')}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Timer className={cn('h-4 w-4 shrink-0', theme.text)} />
            <div>
              <span className={cn('block text-[10px] font-medium uppercase tracking-wide', theme.textMuted)}>
                {t('activity.abyssal.abyssalTimer')}
              </span>
              <span className={cn('font-mono text-xl font-black tabular-nums leading-none', theme.text)}>
                {timeLeft}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {expandedStatusChip}
            {!insideAbyssNow && registrationHelpTooltip}
          </div>
        </div>

        <div className="mt-2 flex min-w-0 items-center gap-1.5 text-[10px]">
          <MapPin
            className={cn(
              'h-3 w-3 shrink-0',
              insideAbyssNow ? 'text-red-400' : 'text-emerald-400'
            )}
          />
          <span className={cn('truncate', insideAbyssNow ? 'text-red-300/90' : theme.textMuted)}>
            {locationDisplay}
          </span>
        </div>

        {activeRun && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={confirmDeath}
            className="mt-2 flex h-7 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 text-[10px] font-medium text-red-300 hover:bg-red-500/20"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />
            {t('activity.abyssal.reportDeath')}
          </Button>
        )}

        {!insideAbyssNow && (
          <div
            ref={registrationRef}
            className="mt-3 space-y-3 border-t border-purple-400/15 pt-3"
          >
            {pendingCount > 0 && (
              <p className="text-[10px] leading-snug text-amber-200/85">
                {t('activity.abyssal.runFinishedLootPending', { count: pendingCount })}
              </p>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <label className={cn('ml-1 text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.abyssal.tier')}
                </label>
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
                  <SelectTrigger className={cn('h-8 text-xs', purpleFieldClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-purple-400/25 bg-[#0c141c]">
                    {ABYSSAL_TIERS.map((tValue: any) => (
                      <SelectItem key={tValue.label} value={tValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-none">
                            <AvatarImage src={tValue.iconPath} className="rounded-none" />
                            <AvatarFallback className="text-[8px] rounded-none">T</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-black uppercase tracking-widest">{tValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className={cn('ml-1 text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.abyssal.weather')}
                </label>
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
                  <SelectTrigger className={cn('h-8 text-xs', purpleFieldClass)}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-purple-400/25 bg-[#0c141c]">
                    {ABYSSAL_WEATHER.map((wValue: any) => (
                      <SelectItem key={wValue.label} value={wValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-none">
                            <AvatarImage src={wValue.iconPath} className="rounded-none" />
                            <AvatarFallback className="text-[8px] rounded-none">W</AvatarFallback>
                          </Avatar>
                          <span className="text-[10px] font-black uppercase tracking-widest">{wValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className={cn('ml-1 text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.abyssal.ship')}
                </label>
                <Input
                  value={ship}
                  placeholder={t('activity.abyssal.shipPlaceholder')}
                  className={cn('h-8 text-[10px] font-medium', purpleFieldClass)}
                  onChange={(e) => setShip(e.target.value)}
                  onBlur={() => {
                    persistData({
                      ...activity.data,
                      lastRunDefaults: { ...activity.data?.lastRunDefaults, ship },
                    })
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label
                  className={cn(
                    'ml-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide',
                    theme.textMuted
                  )}
                >
                  {t('activity.abyssal.beforeCargo')}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn('h-4 w-4', theme.chip)}
                    onClick={() => {
                      setBeforeCargoSectionOpen(true)
                      setIsBeforeCargoEditable(true)
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </label>
                {showCollapsedBeforeCargo ? (
                  <button
                    type="button"
                    onClick={() => setBeforeCargoSectionOpen(true)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] transition-colors',
                      'border-purple-400/20 bg-black/25 hover:border-purple-400/35 hover:bg-purple-500/10',
                      theme.textMuted
                    )}
                  >
                    <span>{t('activity.abyssal.usingSavedCargo')}</span>
                    <span className="font-bold uppercase tracking-wide text-purple-200/90">
                      {t('activity.abyssal.editCargo')}
                    </span>
                  </button>
                ) : (
                  <Textarea
                    value={beforeText}
                    onChange={(e) => setBeforeText(e.target.value)}
                    onBlur={() => {
                      persistData({ ...activity.data, lastCargoState: beforeText })
                    }}
                    readOnly={!isBeforeCargoEditable}
                    placeholder={t('activity.abyssal.pasteCargoHint')}
                    rows={4}
                    className={cn(
                      purpleTextareaClass,
                      'min-h-[72px] resize-y',
                      !isBeforeCargoEditable && 'cursor-not-allowed opacity-60'
                    )}
                  />
                )}
              </div>

              <div className="space-y-1.5">
                <label
                  className={cn(
                    'ml-1 flex items-center justify-between text-[10px] font-bold uppercase tracking-wide',
                    theme.text
                  )}
                >
                  {t('activity.abyssal.afterCargo')}
                  {isCalculating && (
                    <Loader2 className={cn('h-3 w-3 animate-spin', theme.textMuted)} />
                  )}
                </label>
                <Textarea
                  ref={afterTextRef}
                  value={afterText}
                  onChange={(e) => setAfterText(e.target.value)}
                  placeholder={t('activity.abyssal.pasteCargoHint')}
                  rows={4}
                  className={cn(purpleTextareaClass, 'min-h-[72px] resize-y ring-1 ring-purple-400/20')}
                />
              </div>
            </div>

            {preview && (
              <div className="space-y-2">
                <div className={cn(theme.metricShell, 'flex items-center justify-between gap-3 px-3 py-2.5')}>
                  <div>
                    <p className={cn('mb-0.5 text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
                      {t('activity.abyssal.netLootValue')}
                    </p>
                    <p
                      className={cn(
                        'text-lg font-black font-mono tabular-nums tracking-tight',
                        preview.netValue >= 0 ? 'text-emerald-400' : 'text-red-400'
                      )}
                    >
                      {formatISK(preview.netValue)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn('mb-0.5 text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
                      {t('activity.abyssal.itemsFound')}
                    </p>
                    <p className={cn('text-xs font-black font-mono tabular-nums', theme.text)}>
                      {preview.loot.length}
                    </p>
                  </div>
                </div>

                {previewItemCount > 0 && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      className={cn(
                        'h-8 w-full justify-between rounded-lg border text-[10px] font-medium',
                        'border-purple-400/15 bg-black/20 hover:bg-purple-500/10',
                        theme.textMuted
                      )}
                      onClick={() => setPreviewDetailsOpen((open) => !open)}
                    >
                      <span>
                        {previewDetailsOpen
                          ? t('activity.abyssal.hideItemDetails')
                          : t('activity.abyssal.showItemDetails', { count: previewItemCount })}
                      </span>
                      <ChevronDown
                        className={cn(
                          'h-3.5 w-3.5 transition-transform',
                          previewDetailsOpen && 'rotate-180'
                        )}
                      />
                    </Button>

                    {previewDetailsOpen && (
                      <div className="max-h-[140px] space-y-2 overflow-y-auto rounded-lg border border-purple-400/15 bg-black/20 p-2 custom-scrollbar">
                        {preview.loot.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-emerald-300/90">
                              {t('activity.abyssal.gainedItems')}
                            </p>
                            {preview.loot.map((item: any, i: number) => (
                              <div
                                key={`loot-${i}`}
                                className="flex items-center justify-between gap-2 text-[10px]"
                              >
                                <span className={cn('min-w-0 truncate', theme.textMuted)}>{item.name}</span>
                                <span className="shrink-0 font-mono text-emerald-400">
                                  {formatISK(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {preview.consumed.length > 0 && (
                          <div className="space-y-1 border-t border-purple-400/10 pt-2">
                            <p className="text-[9px] font-bold uppercase tracking-wide text-red-300/90">
                              {t('activity.abyssal.usedItems')}
                            </p>
                            {preview.consumed.map((item: any, i: number) => (
                              <div
                                key={`used-${i}`}
                                className="flex items-center justify-between gap-2 text-[10px]"
                              >
                                <span className={cn('min-w-0 truncate', theme.textMuted)}>{item.name}</span>
                                <span className="shrink-0 font-mono text-red-400">
                                  -{formatISK(item.value)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </ActivityThemedPanel>
      </ActivityCardMainSlot>

      <div className="shrink-0 space-y-2">
      {trackingMode === 'manual' && (
        <Button
          type="button"
          className={cn(
            'h-10 w-full rounded-lg border text-[10px] font-medium transition-colors',
            activeRun
              ? 'border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20'
              : 'border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
          )}
          onClick={() => (activeRun ? endActiveRun() : startRun())}
        >
          {activeRun ? <Square className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
          {activeRun ? t('activity.abyssal.stopTimer') : t('activity.abyssal.startTimer')}
        </Button>
      )}

      <Button
        type="button"
        disabled={
          (trackingMode === 'automatic' && insideAbyssNow) ||
          !afterText.trim() ||
          isCalculating ||
          !preview
        }
        className={cn(
          'h-11 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
          afterText.trim() && !insideAbyssNow
            ? 'border-purple-300/50 bg-purple-500 text-white shadow-[0_0_28px_-8px_rgba(168,85,247,0.55)] hover:bg-purple-400'
            : 'border-purple-400/15 bg-black/20 text-purple-300/40'
        )}
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
        {insideAbyssNow
          ? t('activity.abyssal.activeRunLocking')
          : t('activity.abyssal.registerAbyssal')}
      </Button>
      </div>

      {historySection}

      <ActivityCardFooter
        activityType="abyssal"
        mode="expanded"
        onSync={onSync}
        isSyncing={isSyncing}
        syncStatus={syncStatus}
        onTogglePause={onTogglePause!}
        isPaused={isPaused!}
        onEnd={() => setConfirmEndOpen(true)}
        onExport={handleExport}
      />

      {abyssalModals}
    </ActivityCardBody>
  )
}
