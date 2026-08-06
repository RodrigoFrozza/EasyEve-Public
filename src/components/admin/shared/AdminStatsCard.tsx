import { AdminMetricCard } from './AdminMetricCard'
import type { LucideIcon } from 'lucide-react'

/** @deprecated Prefer AdminMetricCard */
export function AdminStatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
}: {
  title: string
  value: string
  trend?: 'up' | 'down'
  trendValue?: string
  icon?: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red'
}) {
  return (
    <AdminMetricCard title={title} value={value} icon={Icon} color={color} />
  )
}
