'use client'

import { useAdminHealth } from '@/lib/admin/hooks/useAdminHealth'
import { useTranslations } from '@/i18n/hooks'
import { Activity, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminStatusStrip() {
  const { t } = useTranslations()
  const { data: health, isLoading } = useAdminHealth()

  const cpu = health?.cpu?.usage ?? 0
  const mem = health?.memory?.percentage ?? 0
  const stressed = cpu > 80 || mem > 85

  return (
    <div className="hidden items-center gap-4 md:flex">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium',
          stressed
            ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400'
            : 'border-border bg-muted/40 text-muted-foreground'
        )}
      >
        <Activity className={cn('h-3.5 w-3.5', stressed ? 'text-amber-600' : 'text-emerald-600')} />
        {isLoading
          ? t('admin.systemStatus.loading')
          : stressed
            ? t('admin.systemStatus.elevated')
            : t('admin.systemStatus.healthy')}
      </div>
      {!isLoading && health && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
          <Cpu className="h-3.5 w-3.5" />
          <span>
            {t('admin.systemStatus.cpuMem', {
              cpu: cpu.toFixed(0),
              mem: mem.toFixed(0),
            })}
          </span>
        </div>
      )}
    </div>
  )
}
