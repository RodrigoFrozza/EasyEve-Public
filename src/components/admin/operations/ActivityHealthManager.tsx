'use client'

import { useAdminActivityHealth, useAdminActivityMetrics } from '@/lib/admin/hooks/useAdminActivityHealth'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { Activity, AlertTriangle, RefreshCw, Flag } from 'lucide-react'

export function ActivityHealthManager() {
  const { t } = useTranslations()
  const { data: health, isLoading } = useAdminActivityHealth()
  const { data: metrics } = useAdminActivityMetrics()

  if (isLoading || !health) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {health.byType.map((row) => (
          <div key={row.type} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold capitalize">{row.type}</h3>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-muted-foreground">{t('admin.operations.total')}</dt>
                <dd className="font-semibold tabular-nums">{row.total}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('admin.operations.active')}</dt>
                <dd className="font-semibold tabular-nums">{row.active}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('admin.operations.completed')}</dt>
                <dd className="font-semibold tabular-nums">{row.completed}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t('admin.operations.staleActive')}</dt>
                <dd
                  className={
                    row.staleActive > 0
                      ? 'font-semibold tabular-nums text-amber-600'
                      : 'font-semibold tabular-nums'
                  }
                >
                  {row.staleActive}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {metrics && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">
            {t('admin.operations.metricsTitle')}
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <AdminMetricCard
              title={t('admin.operations.launchRejected') ?? 'Launch rejected'}
              value={String(metrics.launchRejected)}
              icon={AlertTriangle}
              color="yellow"
            />
            <AdminMetricCard
              title={t('admin.operations.syncFailed') ?? 'Sync errors'}
              value={String(metrics.syncFailed)}
              icon={RefreshCw}
              color="red"
            />
            <AdminMetricCard
              title={t('admin.operations.flagToggles') ?? 'Flag toggles'}
              value={String(metrics.flagToggles)}
              icon={Flag}
              color="blue"
            />
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t('admin.operations.lastUpdated')}:{' '}
        {new Date(health.generatedAt).toLocaleString()}
      </p>
    </div>
  )
}
