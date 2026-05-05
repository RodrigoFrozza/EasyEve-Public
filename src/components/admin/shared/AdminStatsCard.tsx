import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminStatsCard({ 
  title, 
  value, 
  trend, 
  trendValue,
  icon: Icon,
  color = 'blue'
}: { 
  title: string
  value: string
  trend?: 'up' | 'down'
  trendValue?: string
  icon?: React.ElementType
  color?: 'blue' | 'green' | 'yellow' | 'purple' | 'red'
}) {
  const colorClasses = {
    blue: 'border-blue-500/20 bg-blue-500/5',
    green: 'border-green-500/20 bg-green-500/5',
    yellow: 'border-yellow-500/20 bg-yellow-500/5',
    purple: 'border-purple-500/20 bg-purple-500/5',
    red: 'border-red-500/20 bg-red-500/5',
  }

  return (
    <div className={cn('p-4 rounded-lg border backdrop-blur-sm', colorClasses[color])}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-eve-text/60">{title}</span>
        {Icon && <Icon className="w-4 h-4 text-eve-text/40" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-eve-text">{value}</span>
        {trend && trendValue && (
          <span className={cn(
            'text-xs flex items-center gap-1',
            trend === 'up' ? 'text-green-400' : 'text-red-400'
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendValue}
          </span>
        )}
      </div>
    </div>
  )
}
