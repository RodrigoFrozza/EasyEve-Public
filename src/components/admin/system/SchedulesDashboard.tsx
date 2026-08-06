'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  useScriptSchedules,
  useAdminScripts,
  useDeleteSchedule,
  useUpdateSchedule,
  useRunScheduleNow,
  useScheduleExecutions,
  useScriptExecution,
  useCancelScript,
  useEnsureRequiredSchedules,
  type EnrichedScriptSchedule,
} from '@/lib/admin/hooks/useAdminScripts'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { ScheduleFormDialog } from '@/components/admin/system/ScheduleFormDialog'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Play,
  AlertTriangle,
  Terminal,
  Activity,
  Clock,
  HeartPulse,
  Timer,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

function formatDurationMs(ms: number | null | undefined) {
  if (ms == null || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

type IntervalKey = '15m' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom'

export function SchedulesDashboard() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const highlightScriptId = searchParams.get('scriptId')

  const { data, isLoading } = useScriptSchedules({ refetchInterval: 15_000 })
  const schedules = data?.schedules ?? []
  const health = data?.meta?.health

  const { data: scripts } = useAdminScripts()
  const deleteMutation = useDeleteSchedule()
  const updateMutation = useUpdateSchedule()
  const runNowMutation = useRunScheduleNow()
  const cancelMutation = useCancelScript()
  const ensureRequiredMutation = useEnsureRequiredSchedules()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EnrichedScriptSchedule | null>(null)
  const [detailSchedule, setDetailSchedule] = useState<EnrichedScriptSchedule | null>(null)
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null)

  const { data: scheduleExecutions = [] } = useScheduleExecutions(detailSchedule?.id ?? null, {
    limit: 25,
    includeLogs: false,
    enabled: !!detailSchedule,
    refetchInterval: detailSchedule ? 5000 : false,
  })

  const { data: logExecution } = useScriptExecution(selectedExecutionId)

  const frequencyLabel = useCallback(
    (s: EnrichedScriptSchedule) => {
      if (s.interval === 'custom') {
        return t('admin.schedules.cronPrefix', { expr: s.cron || '—' })
      }
      const key = s.interval as IntervalKey
      return t(`admin.schedules.interval.${key}`)
    },
    [t]
  )

  useEffect(() => {
    if (!detailSchedule || scheduleExecutions.length === 0) return
    const stillValid =
      selectedExecutionId && scheduleExecutions.some((e) => e.id === selectedExecutionId)
    if (!stillValid) {
      setSelectedExecutionId(scheduleExecutions[0].id)
    }
  }, [detailSchedule, scheduleExecutions, selectedExecutionId])

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.schedules.deleteConfirm'))) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success(t('admin.schedules.deleted'))
      if (detailSchedule?.id === id) {
        setDetailSchedule(null)
        setSelectedExecutionId(null)
      }
    } catch {
      toast.error(t('admin.schedules.deleteError'))
    }
  }

  const toggleActive = async (s: EnrichedScriptSchedule) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId: s.id,
        active: !s.active,
      })
      toast.success(
        s.active ? t('admin.schedules.deactivated') : t('admin.schedules.activated')
      )
    } catch {
      toast.error(t('admin.schedules.toggleError'))
    }
  }

  const handleRunNow = async (s: EnrichedScriptSchedule) => {
    try {
      const res = await runNowMutation.mutateAsync(s.id)
      toast.success(t('admin.schedules.runStarted'))
      setDetailSchedule(s)
      setSelectedExecutionId(res.executionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('admin.schedules.runError'))
    }
  }

  const handleEnsureRequiredSchedules = async () => {
    try {
      const res = await ensureRequiredMutation.mutateAsync()
      if (res.created.length > 0) {
        toast.success(t('admin.schedules.missingCreated', { scripts: res.created.join(', ') }))
      } else {
        toast.success(t('admin.schedules.missingNoop'))
      }
    } catch {
      toast.error(t('admin.schedules.missingError'))
    }
  }

  const activeCount = schedules.filter((s) => s.active).length
  const overdueCount = schedules.filter((s) => s.overdue).length
  const runs24h = schedules.reduce((acc, s) => acc + (s.stats?.runs24h ?? 0), 0)
  const failures24h = schedules.reduce((acc, s) => acc + (s.stats?.failures24h ?? 0), 0)

  const healthStatus = health?.status ?? 'never'
  const healthLabel = t(`admin.schedules.healthStatus.${healthStatus}`)

  const executionStatusBadge = (status: string) => {
    if (status === 'running' || status === 'pending') return 'warning' as const
    if (status === 'completed') return 'success' as const
    if (status === 'failed') return 'error' as const
    return 'default' as const
  }

  const columns = [
    {
      key: 'name',
      header: t('admin.schedules.colJob'),
      render: (s: EnrichedScriptSchedule) => (
        <div>
          <p className="text-sm font-medium">{s.name}</p>
          <p className="text-xs text-muted-foreground">{s.scriptName}</p>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{s.scriptId}</p>
        </div>
      ),
    },
    {
      key: 'interval',
      header: t('admin.schedules.colFrequency'),
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-2 text-sm">
          <Timer className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{frequencyLabel(s)}</span>
        </div>
      ),
    },
    {
      key: 'nextRunAt',
      header: t('admin.schedules.colNextRun'),
      render: (s: EnrichedScriptSchedule) => (
        <div className="space-y-1">
          {s.nextRunAt ? (
            <span className="text-sm tabular-nums">
              <FormattedDate date={s.nextRunAt} />
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">
              {t('admin.schedules.inactive')}
            </span>
          )}
          {s.overdue && (
            <AdminBadge status="error">{t('admin.schedules.overdue')}</AdminBadge>
          )}
          {s.lastRunAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('admin.schedules.lastRun')}:{' '}
              {new Date(s.lastRunAt).toLocaleString()}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'lastExecution',
      header: t('admin.schedules.colLastRun'),
      render: (s: EnrichedScriptSchedule) => {
        const le = s.lastExecution
        if (!le) {
          return (
            <span className="text-sm text-muted-foreground">
              {t('admin.schedules.nullResult')}
            </span>
          )
        }
        return (
          <div className="space-y-1">
            <AdminBadge status={executionStatusBadge(le.status)}>{le.status}</AdminBadge>
            <p className="text-xs text-muted-foreground tabular-nums">
              {formatDurationMs(le.durationMs ?? undefined)}
            </p>
          </div>
        )
      },
    },
    {
      key: 'status',
      header: t('admin.schedules.colStatus'),
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col gap-2 items-start">
          <div className="flex flex-wrap items-center gap-2">
            <AdminBadge status={s.active ? 'success' : 'default'}>
              {s.active ? t('admin.schedules.active') : t('admin.schedules.standby')}
            </AdminBadge>
            {s.dryRun && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                {t('admin.schedules.dryRun')}
              </span>
            )}
          </div>
          <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: t('admin.schedules.colActions'),
      className: 'text-right',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex justify-end gap-1 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleRunNow(s)}
            disabled={runNowMutation.isPending}
            className="gap-1.5"
          >
            <Play className="h-3.5 w-3.5" />
            {t('admin.schedules.runNow')}
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setDetailSchedule(s)}
            title={t('admin.schedules.viewLogs')}
          >
            <Terminal className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => {
              setEditingSchedule(s)
              setFormOpen(true)
            }}
            title={t('admin.schedules.edit')}
          >
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => handleDelete(s.id)}
            title={t('admin.schedules.delete')}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'rounded-lg border p-6',
          healthStatus === 'healthy'
            ? 'border-border bg-card'
            : 'border-destructive/40 bg-destructive/5'
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={cn(
                'rounded-lg p-3',
                healthStatus === 'healthy'
                  ? 'bg-emerald-500/10 text-emerald-600'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              <HeartPulse className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-semibold">{t('admin.schedules.healthTitle')}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {t('admin.schedules.healthSubtitle')}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AdminBadge
              status={
                healthStatus === 'healthy'
                  ? 'success'
                  : healthStatus === 'stale'
                    ? 'warning'
                    : 'error'
              }
            >
              {healthLabel}
            </AdminBadge>
            <p className="text-xs text-muted-foreground">
              {t('admin.schedules.lastTick')}:{' '}
              {health?.lastTickAt
                ? new Date(health.lastTickAt).toLocaleString()
                : '—'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 border-t border-border pt-6">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('admin.schedules.metricSource')}
            </p>
            <p className="text-sm font-medium mt-1">{health?.lastSource ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('admin.schedules.metricTicks24h')}
            </p>
            <p className="text-sm font-medium mt-1 tabular-nums">
              {health?.ticksLast24h ?? 0}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('admin.schedules.metricDueCount')}
            </p>
            <p className="text-sm font-medium mt-1 tabular-nums">
              {health?.lastDueCount ?? '—'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {t('admin.schedules.metricOverdue')}
            </p>
            <p className="text-sm font-medium mt-1 tabular-nums">
              {health?.overdueSchedules ?? 0}
            </p>
          </div>
        </div>

        {(healthStatus === 'never' || healthStatus === 'stale') && (
          <div className="mt-6 flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">
                {t('admin.schedules.alertTitle')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.schedules.alertBody')}
              </p>
            </div>
          </div>
        )}

        {(health?.missingRequiredSchedules?.length ?? 0) > 0 && (
          <div className="mt-6 flex flex-wrap items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 min-w-[240px]">
              <p className="text-sm font-medium text-destructive">
                {t('admin.schedules.missingAlertTitle')}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t('admin.schedules.missingAlertBody', {
                  scripts: health?.missingRequiredSchedules?.join(', ') ?? '',
                })}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleEnsureRequiredSchedules}
              disabled={ensureRequiredMutation.isPending}
              className="gap-1.5 shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              {t('admin.schedules.createRecommended')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          title={t('admin.schedules.kpiActive')}
          value={String(activeCount)}
          icon={Calendar}
          color="blue"
        />
        <AdminMetricCard
          title={t('admin.schedules.kpiOverdue')}
          value={String(overdueCount)}
          icon={AlertTriangle}
          color="yellow"
        />
        <AdminMetricCard
          title={t('admin.schedules.kpiSuccess24h')}
          value={String(runs24h)}
          icon={Activity}
          color="green"
        />
        <AdminMetricCard
          title={t('admin.schedules.kpiFailures24h')}
          value={String(failures24h)}
          icon={AlertTriangle}
          color="red"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-sm font-semibold">{t('admin.schedules.jobsTitle')}</h3>
        <Button
          size="sm"
          className="gap-2"
          onClick={() => {
            setEditingSchedule(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" />
          {t('admin.schedules.createJob')}
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        data={schedules}
        keyExtractor={(s) => s.id}
        emptyMessage={t('admin.schedules.empty')}
        showRowNumbers
        rowClassName={(s) =>
          highlightScriptId && s.scriptId === highlightScriptId
            ? 'bg-primary/5'
            : undefined
        }
      />

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingSchedule(null)
        }}
        scripts={scripts}
        editingSchedule={editingSchedule}
      />

      <Dialog
        open={!!detailSchedule}
        onOpenChange={(open) => {
          if (!open) {
            setDetailSchedule(null)
            setSelectedExecutionId(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-5xl h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle>
              {detailSchedule?.name} — {t('admin.schedules.detailTitle')}
            </DialogTitle>
          </DialogHeader>

          {detailSchedule && (
            <div className="flex flex-1 min-h-0 flex-col">
              <div className="px-6 py-3 border-b border-border flex flex-wrap gap-6 text-sm shrink-0">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.schedules.detailFrequency')}
                  </p>
                  <p className="font-medium mt-0.5">{frequencyLabel(detailSchedule)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {t('admin.schedules.detailNextRun')}
                  </p>
                  <p className="font-medium mt-0.5">
                    {detailSchedule.nextRunAt ? (
                      <FormattedDate date={detailSchedule.nextRunAt} />
                    ) : (
                      t('admin.schedules.inactive')
                    )}
                  </p>
                </div>
              </div>

              <div className="flex flex-1 min-h-0 grid md:grid-cols-5">
                <div className="md:col-span-2 border-r border-border flex flex-col min-h-0">
                  <p className="text-xs font-medium text-muted-foreground px-4 py-3 border-b border-border">
                    {t('admin.schedules.executions')}
                  </p>
                  <ScrollArea className="flex-1">
                    <div className="p-2 space-y-1">
                      {scheduleExecutions.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => setSelectedExecutionId(ex.id)}
                          className={cn(
                            'w-full text-left rounded-md px-3 py-2.5 text-sm transition-colors',
                            selectedExecutionId === ex.id
                              ? 'bg-muted'
                              : 'hover:bg-muted/60'
                          )}
                        >
                          <div className="flex justify-between items-center gap-2">
                            <AdminBadge status={executionStatusBadge(ex.status)}>
                              {ex.status}
                            </AdminBadge>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {new Date(ex.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-1 truncate">
                            {ex.id}
                          </p>
                        </button>
                      ))}
                      {scheduleExecutions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-12 px-4">
                          {t('admin.schedules.noExecutions')}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="md:col-span-3 flex flex-col min-h-0">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                    <p className="text-xs font-medium text-muted-foreground">
                      {t('admin.schedules.logs')}
                    </p>
                    {logExecution &&
                      (logExecution.status === 'running' ||
                        logExecution.status === 'pending') && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await cancelMutation.mutateAsync(logExecution.id)
                              toast.success(t('admin.schedules.cancelled'))
                            } catch {
                              toast.error(t('admin.schedules.cancelError'))
                            }
                          }}
                          disabled={cancelMutation.isPending}
                        >
                          {t('admin.schedules.cancelRun')}
                        </Button>
                      )}
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-4 font-mono text-xs leading-relaxed space-y-1 min-h-[200px]">
                      {logExecution ? (
                        <>
                          {logExecution.logs?.map((log, i) => (
                            <div
                              key={i}
                              className={cn(
                                'flex gap-3 py-0.5',
                                log.level === 'error' && 'text-destructive',
                                log.level === 'warning' && 'text-amber-600 dark:text-amber-400',
                                log.level === 'success' && 'text-emerald-600 dark:text-emerald-400',
                                log.level !== 'error' &&
                                  log.level !== 'warning' &&
                                  log.level !== 'success' &&
                                  'text-muted-foreground'
                              )}
                            >
                              <span className="shrink-0 w-16 opacity-60">[{log.level}]</span>
                              <span className="break-all">{log.message}</span>
                            </div>
                          ))}
                          {logExecution.error && (
                            <p className="text-destructive font-medium mt-4 p-3 rounded-md bg-destructive/10 border border-destructive/20">
                              {logExecution.error}
                            </p>
                          )}
                          {!logExecution.logs?.length && !logExecution.error && (
                            <p className="text-muted-foreground py-8 text-center text-sm font-sans">
                              {t('admin.schedules.awaitingLogs')}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="text-muted-foreground py-12 text-center text-sm font-sans">
                          {t('admin.schedules.selectExecution')}
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
