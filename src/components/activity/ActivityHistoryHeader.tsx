'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportAndDownloadActivities, ExportActivity } from '@/lib/utils/export-csv'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from '@/i18n/hooks'

interface ActivityHistoryHeaderProps {
  activities: ExportActivity[]
  title?: string
  pageLimit?: number
  onPageLimitChange?: (value: number) => void
}

export function ActivityHistoryHeader({
  activities,
  title,
  pageLimit = 10,
  onPageLimitChange,
}: ActivityHistoryHeaderProps) {
  const { t } = useTranslations()
  const displayTitle = title ?? t('common.operationHistory')

  const handleExport = () => {
    exportAndDownloadActivities(activities, { filename: 'easyeve-activities' })
  }

  return (
    <div className="mb-2 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="h-6 w-1 shrink-0 bg-eve-accent shadow-[0_0_8px_rgba(61,216,224,0.4)]" />
        <h2 className="truncate text-sm font-semibold text-eve-text">{displayTitle}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onPageLimitChange && (
          <Select value={String(pageLimit)} onValueChange={(v) => onPageLimitChange(Number(v))}>
            <SelectTrigger className="h-8 w-[min(100%,7.5rem)] rounded-sm border-eve-border bg-eve-dark text-[10px] font-medium text-eve-muted focus:ring-0 focus:ring-offset-0">
              <SelectValue placeholder={t('activity.tracker.history.entriesLimit')} />
            </SelectTrigger>
            <SelectContent className="rounded-sm border-eve-border bg-eve-panel">
              <SelectItem value="10" className="text-xs">
                {t('activity.tracker.history.entries', { count: 10 })}
              </SelectItem>
              <SelectItem value="20" className="text-xs">
                {t('activity.tracker.history.entries', { count: 20 })}
              </SelectItem>
              <SelectItem value="30" className="text-xs">
                {t('activity.tracker.history.entries', { count: 30 })}
              </SelectItem>
            </SelectContent>
          </Select>
        )}

        {activities.length > 0 && (
          <Button
            variant="outline"
            onClick={handleExport}
            className="h-8 rounded-sm border-eve-border bg-eve-dark px-3 text-[10px] font-medium text-eve-muted hover:border-eve-accent/40 hover:bg-eve-accent/10 hover:text-eve-accent"
          >
            <Download className="mr-2 h-3.5 w-3.5" />
            {t('activity.tracker.history.exportData')}
          </Button>
        )}
      </div>
    </div>
  )
}
