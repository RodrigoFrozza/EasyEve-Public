'use client'

import { useAdminHealth } from '@/lib/admin/hooks/useAdminHealth'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { useTranslations } from '@/i18n/hooks'
import { Cpu, HardDrive, Clock, Activity } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export function HealthMonitorV2() {
  const { t } = useTranslations()
  const { data: health, isLoading } = useAdminHealth()

  if (isLoading || !health) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
    )
  }

  const cpuUsage = health.cpu.usage || 0
  const memPct = health.memory.percentage || 0
  const memUsedGb = (health.memory.used / 1024 / 1024 / 1024).toFixed(1)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AdminMetricCard
          title={t('admin.health.cpu') ?? 'CPU usage'}
          value={`${cpuUsage.toFixed(1)}%`}
          subtitle={`${health.cpu.cores} cores`}
          icon={Cpu}
          color={cpuUsage > 80 ? 'red' : cpuUsage > 50 ? 'yellow' : 'green'}
        />
        <AdminMetricCard
          title={t('admin.health.memory') ?? 'Memory'}
          value={`${memUsedGb} GB`}
          subtitle={`${memPct.toFixed(0)}% of ${(health.memory.total / 1024 / 1024 / 1024).toFixed(1)} GB`}
          icon={HardDrive}
          color={memPct > 85 ? 'red' : 'blue'}
        />
        <AdminMetricCard
          title={t('admin.health.uptime') ?? 'Uptime'}
          value={`${Math.floor(health.uptime / 3600)}h`}
          icon={Clock}
          color="purple"
        />
        <AdminMetricCard
          title={t('admin.systemHealth')}
          value={t('admin.systemStatus.healthy')}
          subtitle={new Date(health.timestamp).toLocaleTimeString()}
          icon={Activity}
          color="green"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-2xl">
        <div className="space-y-2">
          <p className="text-sm font-medium">CPU</p>
          <Progress value={cpuUsage} className="h-2" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('admin.health.memory') ?? 'Memory'}</p>
          <Progress value={memPct} className="h-2" />
        </div>
      </div>
    </div>
  )
}
