'use client'

import { useState } from 'react'
import { PerformanceSection } from './PerformanceSection'
import { RecentActivity } from './RecentActivity'

interface ActivityData {
  id: string
  type: string
  status: string
  startTime: Date
  endTime?: Date | null
  region?: string | null
  space?: string | null
  isPaused: boolean
  typeId?: number | null
  data?: Record<string, unknown> | null
}

interface ActivityPanelProps {
  activities: ActivityData[]
}

export function ActivityPanel({ activities }: ActivityPanelProps) {
  const [activeTab, setActiveTab] = useState<'recent' | 'performance'>('recent')

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-zinc-900/50 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('recent')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'recent'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Recentes
        </button>
        <button
          onClick={() => setActiveTab('performance')}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
            activeTab === 'performance'
              ? 'bg-zinc-800 text-white'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Desempenho
        </button>
      </div>

      {/* Content */}
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