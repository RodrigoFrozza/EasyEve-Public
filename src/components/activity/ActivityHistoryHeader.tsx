'use client'

import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'
import { exportAndDownloadActivities, ExportActivity } from '@/lib/utils/export-csv'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface ActivityHistoryHeaderProps {
  activities: ExportActivity[]
  title?: string
  density?: 'compact' | 'comfortable'
  onDensityChange?: (density: 'compact' | 'comfortable') => void
  pageLimit?: number
  onPageLimitChange?: (value: number) => void
}

export function ActivityHistoryHeader({
  activities,
  title = 'Activity History',
  density = 'compact',
  onDensityChange,
  pageLimit = 10,
  onPageLimitChange,
}: ActivityHistoryHeaderProps) {
  const handleExport = () => {
    exportAndDownloadActivities(activities, { filename: 'easyeve-activities' })
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-6">
        <div className="h-8 w-1 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-[0.2em] font-outfit">{title}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {onDensityChange && (
          <div className="flex items-center rounded-lg border border-white/10 bg-zinc-950/40 p-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDensityChange('compact')}
              className={`h-7 px-3 text-[10px] font-black uppercase tracking-widest ${density === 'compact' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Compact
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onDensityChange('comfortable')}
              className={`h-7 px-3 text-[10px] font-black uppercase tracking-widest ${density === 'comfortable' ? 'bg-blue-500/20 text-blue-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Comfortable
            </Button>
          </div>
        )}

        {onPageLimitChange && (
          <Select value={String(pageLimit)} onValueChange={(v) => onPageLimitChange(Number(v))}>
            <SelectTrigger className="h-8 w-[110px] border-white/10 bg-zinc-950/40 text-[10px] uppercase tracking-wider text-zinc-300">
              <SelectValue placeholder="Per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10 / page</SelectItem>
              <SelectItem value="20">20 / page</SelectItem>
              <SelectItem value="30">30 / page</SelectItem>
            </SelectContent>
          </Select>
        )}

        {activities.length > 0 && (
          <Button
            variant="outline"
            onClick={handleExport}
            className="h-8 px-4 bg-zinc-950/40 border-white/10 text-zinc-400 hover:text-white hover:bg-zinc-900 hover:border-white/20 text-[10px] font-black uppercase tracking-[0.2em] font-outfit backdrop-blur-md rounded-lg transition-all duration-300 group shadow-xl"
          >
            <Download className="h-3.5 w-3.5 mr-2 group-hover:scale-110 transition-transform" />
            Export
          </Button>
        )}
      </div>
    </div>
  )
}