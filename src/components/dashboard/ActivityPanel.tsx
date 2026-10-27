'use client'

import { useState } from 'react'
import { PerformanceSection } from './PerformanceSection'
import { RecentActivity } from './RecentActivity'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

interface ActivityData {
  id: string
  type: string
  status: string
  startTime: Date
  endTime?: Date | null
  region?: string | null
  space?: string | null
  isPaused: boolean
  pausedAt?: Date | string | null
  accumulatedPausedTime?: number | null
  updatedAt?: Date | string | null
  typeId?: number | null
  data?: Record<string, unknown> | null
}

interface ActivityPanelProps {
  activities: ActivityData[]
}

export function ActivityPanel({ activities }: ActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'performance'>('recent')
  const { t } = useTranslations()

  return (
    <div className="ta-panel space-y-4 p-5 font-accent">
      <div
        role="tablist"
        className="flex w-fit items-center gap-1 rounded-[9px] border border-white/[0.07] bg-ta-inset p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'recent'}
          onClick={() => setActiveTab('recent')}
          className={cn(
            'rounded-[6px] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors',
            activeTab === 'recent'
              ? 'bg-eve-accent/[0.12] text-eve-accent ring-1 ring-inset ring-eve-accent/[0.24]'
              : 'text-ta-muted hover:text-ta-body'
          )}
        >
          {t('activity.recent')}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'performance'}
          onClick={() => setActiveTab('performance')}
          className={cn(
            'rounded-[6px] px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.04em] transition-colors',
            activeTab === 'performance'
              ? 'bg-eve-accent/[0.12] text-eve-accent ring-1 ring-inset ring-eve-accent/[0.24]'
              : 'text-ta-muted hover:text-ta-body'
          )}
        >
          {t('dashboard.activityTabPerformance')}
        </button>
      </div>

      <div className="min-h-[400px]">
        {activeTab === 'recent' ? (
          <RecentActivity activities={activities} />
        ) : (
          <PerformanceSection />
        )}
      </div>
    </div>
  )
}