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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

const INTERVAL_VALUES = ['15m', 'hourly', 'daily', 'weekly', 'monthly', 'custom'] as const

export interface ScheduleFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  scripts: Script[] | undefined
  editingSchedule: EnrichedScriptSchedule | ScriptSchedule | null
}

export function ScheduleFormDialog({
  open,
  onOpenChange,
  scripts,
  editingSchedule,
}: ScheduleFormDialogProps) {
  const { t } = useTranslations()
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
        toast.success(t('admin.schedules.form.updated'))
      } else {
        if (!formData.scriptId) {
          toast.error(t('admin.schedules.form.scriptRequired'))
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
        toast.success(t('admin.schedules.form.created'))
      }
      onOpenChange(false)
    } catch {
      toast.error(t('admin.schedules.form.saveError'))
    }
  }

  const isEditing = !!editingSchedule?.id

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? t('admin.schedules.form.editTitle')
              : t('admin.schedules.form.createTitle')}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isEditing
              ? t('admin.schedules.form.editTitle')
              : t('admin.schedules.form.createTitle')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="schedule-script">{t('admin.schedules.form.script')}</Label>
            <Select
              value={formData.scriptId}
              onValueChange={(val) => setFormData({ ...formData, scriptId: val })}
              disabled={isEditing}
            >
              <SelectTrigger id="schedule-script" className="h-9">
                <SelectValue placeholder={t('admin.schedules.form.scriptPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {scripts?.map((script: Script) => (
                  <SelectItem key={script.id} value={script.id}>
                    {script.name}{' '}
                    <span className="text-muted-foreground text-xs">({script.id})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-name">{t('admin.schedules.form.name')}</Label>
            <Input
              id="schedule-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder={t('admin.schedules.form.namePlaceholder')}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('admin.schedules.form.frequency')}</Label>
              <Select
                value={formData.interval}
                onValueChange={(val) => setFormData({ ...formData, interval: val })}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTERVAL_VALUES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`admin.schedules.interval.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.interval === 'custom' && (
              <div className="space-y-2">
                <Label htmlFor="schedule-cron">{t('admin.schedules.form.cron')}</Label>
                <Input
                  id="schedule-cron"
                  value={formData.cron}
                  onChange={(e) => setFormData({ ...formData, cron: e.target.value })}
                  placeholder="0 * * * *"
                  className="font-mono text-sm"
                />
              </div>
            )}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-dry-run">{t('admin.schedules.form.dryRun')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('admin.schedules.form.dryRunHint')}
                </p>
              </div>
              <Switch
                id="schedule-dry-run"
                checked={formData.dryRun}
                onCheckedChange={(val) => setFormData({ ...formData, dryRun: val })}
              />
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="schedule-active">{t('admin.schedules.form.active')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('admin.schedules.form.activeHint')}
                </p>
              </div>
              <Switch
                id="schedule-active"
                checked={formData.active}
                onCheckedChange={(val) => setFormData({ ...formData, active: val })}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('admin.schedules.form.cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
          >
            {isEditing ? t('admin.schedules.form.save') : t('admin.schedules.form.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
