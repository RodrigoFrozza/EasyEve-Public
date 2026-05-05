'use client'

import { useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isExplorationActivity, isAbyssalActivity } from '@/types/domain'
import { ActivityStatDisplay } from '../shared/ActivityStatDisplay'
import { 
  Clock, 
  Box, 
  Target, 
  Crosshair,
  Sparkles,
  Gem,
  Award,
  MapPin
} from 'lucide-react'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'

interface DetailsTabProps {
  activity: ActivityEnhanced
  logs?: any[]
}

export function DetailsTab({ activity, logs = [] }: DetailsTabProps) {
  const { t } = useTranslations()
  
  const data = useMemo(() => activity.data || {}, [activity.data])
  const start = new Date(activity.startTime).getTime()
  const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()

  const metrics = useMemo(() => getActivityFinancialMetrics(activity), [activity])

  // Group logs by type for various stats
  const logsByType = useMemo(() => {
    const grouped: Record<string, any[]> = {}
    ;(logs || []).forEach((log: any) => {
      const key = log.type || log.oreName || 'unknown'
      if (!grouped[key]) grouped[key] = []
      grouped[key].push(log)
    })
    return grouped
  }, [logs])

  // Top items by value
  const topItems = useMemo(() => {
    const items: Array<{ name: string; value: number; quantity: number }> = []
    
    if (isMiningActivity(activity)) {
      const oreGroups: Record<string, { value: number; quantity: number }> = {}
      ;(logs || []).forEach((log: any) => {
        const oreName = log.oreName || 'Unknown'
        if (!oreGroups[oreName]) oreGroups[oreName] = { value: 0, quantity: 0 }
        oreGroups[oreName].value += log.value || 0
        oreGroups[oreName].quantity += log.quantity || 0
      })
      Object.entries(oreGroups)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 5)
        .forEach(([name, stats]) => {
          items.push({ name, value: stats.value, quantity: stats.quantity })
        })
    } else if (isRattingActivity(activity)) {
      const typeGroups: Record<string, { value: number; count: number }> = {}
      ;(logs || []).forEach((log: any) => {
        const typeName = log.type || log.npcName || 'Unknown'
        if (!typeGroups[typeName]) typeGroups[typeName] = { value: 0, count: 0 }
        typeGroups[typeName].value += log.amount || 0
        typeGroups[typeName].count += 1
      })
      Object.entries(typeGroups)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 5)
        .forEach(([name, stats]) => {
          items.push({ name, value: stats.value, quantity: stats.count })
        })
    } else if (isExplorationActivity(activity)) {
      const itemGroups: Record<string, { value: number; quantity: number }> = {}
      ;(data.lootContents || []).forEach((item: { name?: string; value?: number; quantity?: number }) => {
        const name = item.name || 'Unknown'
        if (!itemGroups[name]) itemGroups[name] = { value: 0, quantity: 0 }
        itemGroups[name].value += item.value || 0
        itemGroups[name].quantity += item.quantity || 0
      })
      Object.entries(itemGroups)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 5)
        .forEach(([name, stats]) => {
          items.push({ name, value: stats.value, quantity: stats.quantity })
        })
    } else if (isAbyssalActivity(activity)) {
      const itemGroups: Record<string, { value: number; quantity: number }> = {}
      ;(data.lootContents || []).forEach((item: any) => {
        const name = item.name || 'Unknown'
        if (!itemGroups[name]) itemGroups[name] = { value: 0, quantity: 0 }
        itemGroups[name].value += item.value || 0
        itemGroups[name].quantity += item.quantity || 0
      })
      Object.entries(itemGroups)
        .sort((a, b) => b[1].value - a[1].value)
        .slice(0, 5)
        .forEach(([name, stats]) => {
          items.push({ name, value: stats.value, quantity: stats.quantity })
        })
    }
    
    return items
  }, [activity, logs, data])

  return (
    <div className="space-y-6">
      {/* Session Info */}
      <div className="space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          {t('common.session.sessionInfo')}
        </h3>
        
        <div className="grid grid-cols-2 gap-3">
          <ActivityStatDisplay
            label={t('common.session.start')}
            value={new Date(activity.startTime).toLocaleString()}
            icon={<Clock className="h-4 w-4" />}
            variant="default"
            size="compact"
          />
          <ActivityStatDisplay
            label={t('common.session.end')}
            value={activity.endTime ? new Date(activity.endTime).toLocaleString() : t('common.session.inProgress')}
            icon={<Clock className="h-4 w-4" />}
            variant="default"
            size="compact"
          />
          <ActivityStatDisplay
            label={t('common.session.duration')}
            value={formatDuration(start, end)}
            icon={<Clock className="h-4 w-4" />}
            variant="default"
            size="compact"
          />
          <ActivityStatDisplay
            label={t('common.session.location')}
            value={data.siteName || data.system || activity.type}
            icon={<MapPin className="h-4 w-4" />}
            variant="default"
            size="compact"
          />
        </div>
      </div>

      {/* Type-specific Details */}
      {isMiningActivity(activity) && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('common.session.miningDetails')}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <ActivityStatDisplay
              label={t('activity.mining.volumeM3')}
              value={data.totalQuantity || 0}
              icon={<Box className="h-4 w-4" />}
              variant="accent"
              formatAsNumber
              subValue="m³"
              size="compact"
            />
            <ActivityStatDisplay
              label={t('common.session.oreTypes')}
              value={Object.keys(logsByType).length}
              icon={<Gem className="h-4 w-4" />}
              variant="default"
              formatAsNumber
              size="compact"
            />
          </div>
        </div>
      )}

      {isRattingActivity(activity) && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('common.session.combatDetails')}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <ActivityStatDisplay
              label={t('common.session.kills')}
              value={logs.filter((l: any) => l.type === 'bounty').length}
              icon={<Target className="h-4 w-4" />}
              variant="danger"
              formatAsNumber
              size="compact"
            />
            <ActivityStatDisplay
              label={t('common.session.averageKill')}
              value={metrics.net / Math.max(1, logs.filter((l: any) => l.type === 'bounty').length)}
              icon={<Award className="h-4 w-4" />}
              variant="accent"
              formatAsISK
              size="compact"
            />
          </div>
        </div>
      )}

      {isAbyssalActivity(activity) && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('common.session.abyssalDetails')}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <ActivityStatDisplay
              label={t('activity.abyssal.runsCompleted')}
              value={(data.runs || []).filter((r: any) => r.status === 'completed').length}
              icon={<Sparkles className="h-4 w-4" />}
              variant="accent"
              formatAsNumber
              size="compact"
            />
            <ActivityStatDisplay
              label={t('activity.abyssal.tier')}
              value={data.lastRunDefaults?.tier || data.tier || t('common.notAvailable')}
              icon={<Crosshair className="h-4 w-4" />}
              variant="warning"
              size="compact"
            />
          </div>
        </div>
      )}

      {isExplorationActivity(activity) && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('common.session.explorationDetails')}
          </h3>
          
          <div className="grid grid-cols-2 gap-3">
            <ActivityStatDisplay
              label={t('activity.exploration.sitesCompleted')}
              value={data.sitesCompleted || 0}
              icon={<MapPin className="h-4 w-4" />}
              variant="accent"
              formatAsNumber
              size="compact"
            />
            <ActivityStatDisplay
              label={t('common.type')}
              value={data.siteType || t('common.notAvailable')}
              icon={<Target className="h-4 w-4" />}
              variant="default"
              size="compact"
            />
          </div>
        </div>
      )}

      {/* Top Items */}
      {topItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {t('common.session.topItems')}
          </h3>
          
          <div className="space-y-2">
            {topItems.map((item, idx) => (
              <div 
                key={idx}
                className="flex items-center justify-between px-4 py-3 bg-zinc-950/40 border border-white/5 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 text-center text-[10px] font-black text-zinc-500">
                    #{idx + 1}
                  </span>
                  <span className="text-sm font-black text-zinc-300 truncate max-w-[200px]">
                    {item.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-zinc-200 font-mono">
                    {formatISK(item.value)}
                  </p>
                  <p className="text-[9px] text-zinc-500 font-mono">
                    {formatNumber(item.quantity)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDuration(start: number, end: number): string {
  const diffMs = end - start
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}