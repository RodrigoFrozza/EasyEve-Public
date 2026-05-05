'use client'

import { useState } from 'react'
import {
  useScriptSchedules,
  useDeleteSchedule,
  useUpdateSchedule,
  useAdminScripts,
  type EnrichedScriptSchedule,
} from '@/lib/admin/hooks/useAdminScripts'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Calendar, Plus, Trash2, Edit2, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ScheduleFormDialog } from '@/components/admin/system/ScheduleFormDialog'

const INTERVALS = [
  { value: '15m', label: 'Every 15 Minutes' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (Cron)' },
]

export function ScriptSchedulesV2() {
  const { data, isLoading: isLoadingSchedules } = useScriptSchedules({ refetchInterval: false })
  const schedules = data?.schedules ?? []
  const { data: scripts } = useAdminScripts()

  const deleteMutation = useDeleteSchedule()
  const updateMutation = useUpdateSchedule()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<EnrichedScriptSchedule | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('Schedule deleted')
    } catch {
      toast.error('Failed to delete schedule')
    }
  }

  const toggleActive = async (schedule: EnrichedScriptSchedule) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId: schedule.id,
        active: !schedule.active,
      })
      toast.success(`Schedule ${!schedule.active ? 'activated' : 'deactivated'}`)
    } catch {
      toast.error('Failed to update status')
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col">
          <span className="font-medium text-eve-text">{s.name}</span>
          <span className="text-xs text-eve-text/40">{s.scriptId}</span>
        </div>
      ),
    },
    {
      key: 'interval',
      header: 'Frequency',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-eve-accent" />
          <span className="text-sm text-eve-text/80">
            {s.interval === 'custom' ? `Cron: ${s.cron}` : INTERVALS.find((i) => i.value === s.interval)?.label || s.interval}
          </span>
        </div>
      ),
    },
    {
      key: 'nextRunAt',
      header: 'Next Run',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col">
          {s.nextRunAt ? (
            <span className="text-sm text-eve-text/80">
              <FormattedDate date={s.nextRunAt} />
            </span>
          ) : (
            <span className="text-sm text-eve-text/40">Never</span>
          )}
          {s.lastRunAt && (
            <span className="text-[10px] text-eve-text/30">Last: {new Date(s.lastRunAt).toLocaleString()}</span>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-3">
          <AdminBadge status={s.active ? 'success' : 'default'}>{s.active ? 'Active' : 'Paused'}</AdminBadge>
          {s.dryRun && <AdminBadge status="info">Dry Run</AdminBadge>}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex justify-end gap-1">
          <Switch checked={s.active} onCheckedChange={() => toggleActive(s)} className="mr-2" />
          <Button size="sm" variant="ghost" onClick={() => { setEditingSchedule(s); setFormOpen(true) }}>
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => handleDelete(s.id)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      ),
      className: 'w-40',
    },
  ]

  if (isLoadingSchedules) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium text-eve-text flex items-center gap-2">
          <Calendar className="w-5 h-5 text-eve-accent" />
          Scheduled Tasks
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
          New Schedule
        </Button>
      </div>

      <AdminTable columns={columns} data={schedules} keyExtractor={(s) => s.id} emptyMessage="No schedules configured." />

      <ScheduleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) setEditingSchedule(null)
        }}
        scripts={scripts}
        editingSchedule={editingSchedule}
      />
    </div>
  )
}
