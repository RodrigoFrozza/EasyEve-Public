'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  type EnrichedScriptSchedule,
} from '@/lib/admin/hooks/useAdminScripts'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { AdminStatsCard } from '@/components/admin/shared/AdminStatsCard'
import { ScheduleFormDialog } from '@/components/admin/system/ScheduleFormDialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { FormattedDate } from '@/components/shared/FormattedDate'
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
  ExternalLink,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const INTERVALS: { value: string; label: string }[] = [
  { value: '15m', label: 'Every 15 Minutes' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (Cron)' },
]

function formatDurationMs(ms: number | null | undefined) {
  if (ms == null || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function frequencyLabel(s: EnrichedScriptSchedule) {
  if (s.interval === 'custom') return `Cron: ${s.cron || '—'}`
  return INTERVALS.find((i) => i.value === s.interval)?.label || s.interval
}

export function SchedulesDashboard() {
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

  useEffect(() => {
    if (!detailSchedule || scheduleExecutions.length === 0) return
    const stillValid = selectedExecutionId && scheduleExecutions.some((e) => e.id === selectedExecutionId)
    if (!stillValid) {
      setSelectedExecutionId(scheduleExecutions[0].id)
    }
  }, [detailSchedule, scheduleExecutions, selectedExecutionId])

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Schedule deleted')
      if (detailSchedule?.id === id) {
        setDetailSchedule(null)
        setSelectedExecutionId(null)
      }
    } catch {
      toast.error('Failed to delete schedule')
    }
  }

  const toggleActive = async (s: EnrichedScriptSchedule) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId: s.id,
        active: !s.active,
      })
      toast.success(`Schedule ${!s.active ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const handleRunNow = async (s: EnrichedScriptSchedule) => {
    try {
      const res = await runNowMutation.mutateAsync(s.id)
      toast.success('Run started')
      setDetailSchedule(s)
      setSelectedExecutionId(res.executionId)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to run schedule')
    }
  }

  const activeCount = schedules.filter((s) => s.active).length
  const overdueCount = schedules.filter((s) => s.overdue).length
  const runs24h = schedules.reduce((acc, s) => acc + (s.stats?.runs24h ?? 0), 0)
  const failures24h = schedules.reduce((acc, s) => acc + (s.stats?.failures24h ?? 0), 0)

  const healthStatus = health?.status ?? 'never'
  const healthBannerClass =
    healthStatus === 'healthy'
      ? 'border-green-500/30 bg-green-500/10'
      : healthStatus === 'stale'
        ? 'border-yellow-500/30 bg-yellow-500/10'
        : 'border-red-500/30 bg-red-500/10'

  const columns = [
    {
      key: 'name',
      header: 'Schedule / Script',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col max-w-xs">
          <span className="font-medium text-eve-text">{s.name}</span>
          <span className="text-xs text-eve-text/50">{s.scriptName}</span>
          <span className="text-[10px] text-eve-text/30 font-mono">{s.scriptId}</span>
        </div>
      ),
    },
    {
      key: 'interval',
      header: 'Frequency',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-eve-accent shrink-0" />
          <span className="text-sm text-eve-text/80">{frequencyLabel(s)}</span>
        </div>
      ),
    },
    {
      key: 'nextRunAt',
      header: 'Next / Last',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            {s.nextRunAt ? (
              <span className="text-sm text-eve-text/80">
                <FormattedDate date={s.nextRunAt} />
              </span>
            ) : (
              <span className="text-sm text-eve-text/40">Never</span>
            )}
            {s.overdue && <AdminBadge status="error">Overdue</AdminBadge>}
          </div>
          {s.lastRunAt && (
            <span className="text-[10px] text-eve-text/30">
              Last tick: {new Date(s.lastRunAt).toLocaleString()}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'lastExecution',
      header: 'Last execution',
      render: (s: EnrichedScriptSchedule) => {
        const le = s.lastExecution
        if (!le) return <span className="text-sm text-eve-text/40">No runs yet</span>
        const badge =
          le.status === 'running' || le.status === 'pending'
            ? 'warning'
            : le.status === 'completed'
              ? 'success'
              : le.status === 'failed'
                ? 'error'
                : 'default'
        return (
          <div className="flex flex-col gap-1">
            <AdminBadge status={badge}>{le.status}</AdminBadge>
            <span className="text-[10px] text-eve-text/40">
              {formatDurationMs(le.durationMs ?? undefined)}
              {le.completedAt && (
                <> · {new Date(le.completedAt).toLocaleString()}</>
              )}
            </span>
          </div>
        )
      },
    },
    {
      key: 'stats',
      header: '24h',
      render: (s: EnrichedScriptSchedule) => (
        <div className="text-xs text-eve-text/60">
          <div>Runs: {s.stats?.runs24h ?? 0}</div>
          <div className="text-red-400/80">Fail: {s.stats?.failures24h ?? 0}</div>
          {s.stats?.avgDurationMs != null && <div>Avg: {formatDurationMs(s.stats.avgDurationMs)}</div>}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col gap-2 items-start">
          <div className="flex items-center gap-2 flex-wrap">
            <AdminBadge status={s.active ? 'success' : 'default'}>{s.active ? 'Active' : 'Paused'}</AdminBadge>
            {s.dryRun && <AdminBadge status="info">Dry Run</AdminBadge>}
          </div>
          <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex justify-end gap-1 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => handleRunNow(s)} disabled={runNowMutation.isPending}>
            <Play className="w-3 h-3 mr-1" />
            Run now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDetailSchedule(s)} title="History & logs">
            <Terminal className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" asChild title="Scripts registry">
            <Link href="/dashboard/admin/system/scripts">
              <ExternalLink className="w-3 h-3" />
            </Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => { setEditingSchedule(s); setFormOpen(true) }}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-400 hover:text-red-300"
            onClick={() => handleDelete(s.id)}
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ),
      className: 'min-w-[200px]',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div
        className={cn(
          'rounded-lg border p-4 space-y-2',
          healthBannerClass
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-eve-text flex items-center gap-2">
            <Activity className="w-4 h-4 text-eve-accent" />
            Scheduler health
          </h3>
          <AdminBadge
            status={healthStatus === 'healthy' ? 'success' : healthStatus === 'stale' ? 'warning' : 'error'}
          >
            {healthStatus}
          </AdminBadge>
        </div>
        <div className="grid gap-2 text-xs text-eve-text/70 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            Last tick:{' '}
            {health?.lastTickAt ? new Date(health.lastTickAt).toLocaleString() : '—'}
          </div>
          <div>Source: {health?.lastSource ?? '—'}</div>
          <div>Ticks (24h): {health?.ticksLast24h ?? 0}</div>
          <div>Due (last tick): {health?.lastDueCount ?? '—'}</div>
        </div>
        {(healthStatus === 'never' || healthStatus === 'stale') && (
          <p className="text-xs text-eve-text/60 border-t border-eve-border/20 pt-2 mt-2">
            The scheduler is not ticking reliably. Configure an external caller to{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 font-mono text-[10px]">
              GET /api/admin/scripts/scheduler/trigger
            </code>{' '}
            on a short interval (see repository doc{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-[10px]">docs/AUTOMATION_SYSTEM.md</code>
            ). Alternatively set{' '}
            <code className="rounded bg-black/30 px-1 font-mono text-[10px]">SCHEDULER_INTERNAL_ENABLED=true</code>{' '}
            for an in-process fallback (not preferred for multi-instance).
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatsCard title="Active schedules" value={String(activeCount)} icon={Calendar} color="blue" />
        <AdminStatsCard title="Overdue" value={String(overdueCount)} icon={AlertTriangle} color="yellow" />
        <AdminStatsCard title="Runs (24h)" value={String(runs24h)} icon={Activity} color="green" />
        <AdminStatsCard title="Failures (24h)" value={String(failures24h)} icon={AlertTriangle} color="red" />
      </div>

      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="text-lg font-medium text-eve-text flex items-center gap-2">
          <Calendar className="w-5 h-5 text-eve-accent" />
          Scheduled jobs
        </h3>
        <Button
          size="sm"
          onClick={() => {
            setEditingSchedule(null)
            setFormOpen(true)
          }}
          className="bg-eve-accent text-white hover:bg-eve-accent/80"
        >
          <Plus className="w-4 h-4 mr-1" />
          New schedule
        </Button>
      </div>

      <AdminTable
        columns={columns}
        data={schedules}
        keyExtractor={(s) => s.id}
        emptyMessage="No schedules configured."
        rowClassName={(s) =>
          cn(highlightScriptId && s.scriptId === highlightScriptId && 'bg-eve-accent/5 ring-1 ring-eve-accent/30')
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
        <DialogContent className="bg-eve-panel border-eve-border/30 max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-eve-text">
              Schedule: {detailSchedule?.name}{' '}
              <span className="text-sm font-normal text-eve-text/50">({detailSchedule?.scriptId})</span>
            </DialogTitle>
          </DialogHeader>

          {detailSchedule && (
            <div className="flex-1 overflow-hidden flex flex-col gap-4 min-h-0">
              <div className="text-xs text-eve-text/50 space-y-1 shrink-0">
                <div>Frequency: {frequencyLabel(detailSchedule)}</div>
                <div>Next run: {detailSchedule.nextRunAt ? <FormattedDate date={detailSchedule.nextRunAt} /> : '—'}</div>
              </div>

              <div className="flex-1 min-h-0 grid md:grid-cols-2 gap-4">
                <div className="flex flex-col min-h-0 border border-eve-border/20 rounded-lg">
                  <div className="text-xs font-medium text-eve-text/60 px-3 py-2 border-b border-eve-border/20">
                    Recent executions
                  </div>
                  <ScrollArea className="h-64 md:h-80">
                    <div className="p-2 space-y-1">
                      {scheduleExecutions.map((ex) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => setSelectedExecutionId(ex.id)}
                          className={cn(
                            'w-full text-left rounded-md p-2 text-xs transition-colors',
                            selectedExecutionId === ex.id
                              ? 'bg-eve-accent/15 border border-eve-accent/30'
                              : 'bg-eve-background/40 hover:bg-eve-background/60 border border-transparent'
                          )}
                        >
                          <div className="flex justify-between gap-2">
                            <AdminBadge
                              status={
                                ex.status === 'running' || ex.status === 'pending'
                                  ? 'warning'
                                  : ex.status === 'completed'
                                    ? 'success'
                                    : ex.status === 'failed'
                                      ? 'error'
                                      : 'default'
                              }
                            >
                              {ex.status}
                            </AdminBadge>
                            <span className="text-eve-text/40 shrink-0">
                              {new Date(ex.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {ex.error && <p className="text-red-400/90 mt-1 truncate">{ex.error}</p>}
                        </button>
                      ))}
                      {scheduleExecutions.length === 0 && (
                        <p className="text-center text-sm text-eve-text/40 py-6">No executions for this schedule yet.</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <div className="flex flex-col min-h-0 border border-eve-border/20 rounded-lg">
                  <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-eve-border/20 shrink-0">
                    <span className="text-xs font-medium text-eve-text/60">Execution log</span>
                    {logExecution && (logExecution.status === 'running' || logExecution.status === 'pending') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="h-7 text-xs"
                        onClick={async () => {
                          try {
                            await cancelMutation.mutateAsync(logExecution.id)
                            toast.success('Cancellation requested')
                          } catch {
                            toast.error('Failed to cancel')
                          }
                        }}
                        disabled={cancelMutation.isPending}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-64 md:h-80">
                    <div className="p-3 font-mono text-xs space-y-1">
                      {logExecution ? (
                        <>
                          {logExecution.logs?.map((log, i) => (
                            <div
                              key={i}
                              className={
                                log.level === 'error'
                                  ? 'text-red-400'
                                  : log.level === 'warning'
                                    ? 'text-yellow-400'
                                    : log.level === 'success'
                                      ? 'text-green-400'
                                      : 'text-eve-text/80'
                              }
                            >
                              [{String(log.level).toUpperCase()}] {log.message}
                            </div>
                          ))}
                          {logExecution.error && (
                            <div className="text-red-400 border-t border-eve-border/20 pt-2 mt-2">
                              {logExecution.error}
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="text-eve-text/40">Select an execution to view logs.</p>
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
