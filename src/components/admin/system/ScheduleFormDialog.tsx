'use client'

import { useState, useEffect } from 'react'
import {
  useCreateSchedule,
  useUpdateSchedule,
  type Script,
  type EnrichedScriptSchedule,
  type ScriptSchedule,
} from '@/lib/admin/hooks/useAdminScripts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const INTERVALS = [
  { value: '15m', label: 'Every 15 Minutes' },
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom (Cron)' },
]

export interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scripts: Script[] | undefined
  /** Pass schedule with `id` to edit; null for create */
  editingSchedule: EnrichedScriptSchedule | ScriptSchedule | null
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  scripts,
  editingSchedule,
}: ScheduleFormDialogProps) {
  const createMutation = useCreateSchedule()
  const updateMutation = useUpdateSchedule()

  const [formData, setFormData] = useState({
    scriptId: '',
    name: '',
    interval: 'daily',
    cron: '',
    dryRun: false,
    active: true,
  })

  useEffect(() => {
    if (!open) return
    if (editingSchedule?.id) {
      setFormData({
        scriptId: editingSchedule.scriptId,
        name: editingSchedule.name,
        interval: editingSchedule.interval,
        cron: editingSchedule.cron || '',
        dryRun: editingSchedule.dryRun,
        active: editingSchedule.active,
      })
    } else {
      setFormData({
        scriptId: '',
        name: '',
        interval: 'daily',
        cron: '',
        dryRun: false,
        active: true,
      })
    }
  }, [open, editingSchedule])

  const handleSubmit = async () => {
    try {
      if (editingSchedule?.id) {
        await updateMutation.mutateAsync({
          scheduleId: editingSchedule.id,
          name: formData.name,
          interval: formData.interval,
          cron: formData.cron || undefined,
          dryRun: formData.dryRun,
          active: formData.active,
        })
        toast.success('Schedule updated')
      } else {
        if (!formData.scriptId) {
          toast.error('Please select a script')
          return
        }
        await createMutation.mutateAsync({
          scriptId: formData.scriptId,
          name: formData.name || formData.scriptId,
          interval: formData.interval,
          cron: formData.cron || undefined,
          dryRun: formData.dryRun,
          active: formData.active,
        })
        toast.success('Schedule created')
      }
      onOpenChange(false)
    } catch {
      toast.error('Failed to save schedule')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-eve-panel border-eve-border/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-eve-text">
            {editingSchedule?.id ? 'Edit Schedule' : 'Create New Schedule'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm text-eve-text/60">Script to Execute</label>
            <Select
              value={formData.scriptId}
              onValueChange={(val) => setFormData({ ...formData, scriptId: val })}
              disabled={!!editingSchedule?.id}
            >
              <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                <SelectValue placeholder="Select a script..." />
              </SelectTrigger>
              <SelectContent>
                {scripts?.map((script: Script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.name} ({script.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-eve-text/60">Schedule Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Daily Wallet Sync"
              className="bg-eve-background/50 border-eve-border/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm text-eve-text/60">Frequency</label>
              <Select
                value={formData.interval}
                onValueChange={(val) => setFormData({ ...formData, interval: val })}
              >
                <SelectTrigger className="bg-eve-background/50 border-eve-border/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVALS.map((i) => (
                    <SelectItem key={i.value} value={i.value}>
                      {i.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.interval === 'custom' && (
              <div className="space-y-2">
                <label className="text-sm text-eve-text/60">Cron Expression</label>
                <Input
                  value={formData.cron}
                  onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                  placeholder="* * * * *"
                  className="bg-eve-background/50 border-eve-border/30 font-mono"
                />
                <p className="text-[10px] text-eve-text/40">Min Hour Day Month DayOfWeek</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 bg-eve-background/30 rounded-lg border border-eve-border/10">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-eve-text">Dry Run Mode</label>
              <p className="text-xs text-eve-text/40">Log actions without modifying data</p>
            </div>
            <Switch
              checked={formData.dryRun}
              onCheckedChange={(val) => setFormData({ ...formData, dryRun: val })}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-eve-background/30 rounded-lg border border-eve-border/10">
            <div className="space-y-0.5">
              <label className="text-sm font-medium text-eve-text">Active</label>
              <p className="text-xs text-eve-text/40">Enable or disable this schedule</p>
            </div>
            <Switch
              checked={formData.active}
              onCheckedChange={(val) => setFormData({ ...formData, active: val })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="bg-eve-accent text-white"
          >
            {editingSchedule?.id ? 'Update Schedule' : 'Create Schedule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
