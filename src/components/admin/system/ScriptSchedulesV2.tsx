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
import { Calendar, Plus, Trash2, Edit2, Clock, Terminal, Activity, Hash } from 'lucide-react'
import { toast } from 'sonner'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ScheduleFormDialog } from '@/components/admin/system/ScheduleFormDialog'
import { cn } from '@/lib/utils'

const INTERVALS = [
  { value: '15m', label: '15m' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom' },
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
    if (!confirm('CONFIRM_SCHEDULE_DELETION?')) return
    try {
      await deleteMutation.mutateAsync(id)
      toast.success('SCHEDULE_PURGED')
    } catch {
      toast.error('PURGE_FAULT')
    }
  }

  const toggleActive = async (schedule: EnrichedScriptSchedule) => {
    try {
      await updateMutation.mutateAsync({
        scheduleId: schedule.id,
        active: !schedule.active,
      })
      toast.success(`STATE_CHANGE: ${!schedule.active ? 'ACTIVE' : 'PAUSED'}`)
    } catch {
      toast.error('STATE_TRANSITION_FAULT')
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'SCHEDULE_IDENT',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-zinc-200 tracking-tight">{s.name.toUpperCase()}</span>
            {s.dryRun && (
              <span className="bg-zinc-800 text-zinc-500 text-[8px] font-mono px-1 border border-zinc-700">DRY_RUN</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 opacity-40">
            <Hash className="w-2.5 h-2.5" />
            <span className="text-[9px] font-mono text-zinc-400">{s.scriptId}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'interval',
      header: 'FREQUENCY_MASK',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-2 font-mono">
          <Clock className="w-3 h-3 text-zinc-600" />
          <span className="text-[10px] text-zinc-400 uppercase tracking-tighter">
            {s.interval === 'custom' ? `CRON: ${s.cron}` : INTERVALS.find((i) => i.value === s.interval)?.label || s.interval}
          </span>
        </div>
      ),
    },
    {
      key: 'nextRunAt',
      header: 'NEXT_EXECUTION',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex flex-col font-mono">
          {s.nextRunAt ? (
            <span className="text-[10px] text-zinc-300">
              <FormattedDate date={s.nextRunAt} />
            </span>
          ) : (
            <span className="text-[10px] text-zinc-600">IDLE</span>
          )}
          {s.lastRunAt && (
            <div className="flex items-center gap-1 opacity-30 mt-0.5">
              <Activity className="w-2.5 h-2.5" />
              <span className="text-[8px] text-zinc-400 uppercase">PREV: {new Date(s.lastRunAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex items-center gap-4">
          <AdminBadge 
            status={s.active ? 'success' : 'default'}
            className={cn(
            "rounded-md px-1.5 py-0 text-[9px] font-sans font-bold uppercase tracking-wider border-none shadow-none",
            s.active ? "bg-zinc-200 text-zinc-950" : "bg-zinc-800 text-zinc-600"
          )}>
            {s.active ? 'Active' : 'Paused'}
          </AdminBadge>
          <Switch 
            checked={s.active} 
            onCheckedChange={() => toggleActive(s)} 
            className="data-[state=checked]:bg-zinc-700 data-[state=unchecked]:bg-zinc-900 border-zinc-800"
          />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'TRACER',
      render: (s: EnrichedScriptSchedule) => (
        <div className="flex justify-end gap-1">
          <Button 
            size="sm" 
            variant="ghost" 
            onClick={() => { setEditingSchedule(s); setFormOpen(true) }}
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 w-7 p-0 text-zinc-700 hover:text-red-400 hover:bg-red-500/10" 
            onClick={() => handleDelete(s.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
      className: 'w-24',
    },
  ]

  if (isLoadingSchedules) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-zinc-900/50 animate-pulse border border-zinc-900" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end border-b border-zinc-900 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-zinc-500" />
            <h3 className="text-xs font-mono font-bold text-zinc-200 uppercase tracking-[0.2em]">
              SCHEDULED_TASK_REGISTRY
            </h3>
          </div>
          <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-tight">Active_automation_cycles_and_cron_monitors</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingSchedule(null)
            setFormOpen(true)
          }}
          className="bg-zinc-100 text-zinc-950 hover:bg-zinc-300 rounded-none h-8 font-mono text-[10px] font-bold uppercase tracking-widest px-4"
        >
          <Plus className="w-3.5 h-3.5 mr-2" />
          Add_Schedule
        </Button>
      </div>

      <AdminTable 
        columns={columns} 
        data={schedules} 
        keyExtractor={(s) => s.id} 
        emptyMessage="SYSTEM_EMPTY: NO_SCHEDULES_CONFIGURED" 
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
    </div>
  )
}
