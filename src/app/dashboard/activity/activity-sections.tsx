'use client'

import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Target } from 'lucide-react'
import { ActivityCard } from '@/components/activity/ActivityCard'
import { ActivityHistoryHeader } from '@/components/activity/ActivityHistoryHeader'
import { OperationHistoryList } from '@/components/activity/OperationHistoryList'
import type { Activity } from '@/lib/stores/activity-store'

type ActiveOperationsPanelProps = {
  activeActivities: Activity[]
  tourCreatedActivityId: string | null
  noActiveOperationsText: string
  launchNewActivityText: string
  onEndActivity: (id: string) => void
}

export function ActiveOperationsPanel({
  activeActivities,
  tourCreatedActivityId,
  noActiveOperationsText,
  launchNewActivityText,
  onEndActivity,
}: ActiveOperationsPanelProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" data-tour="active-activities-section">
      {activeActivities.length === 0 ? (
        <Card className="col-span-full bg-eve-panel border-dashed border-eve-border py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="bg-eve-dark p-4 rounded-full mb-4">
              <Target className="h-10 w-10 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-white">{noActiveOperationsText}</h3>
            <p className="text-sm text-gray-500 max-w-xs mt-2">{launchNewActivityText}</p>
          </CardContent>
        </Card>
      ) : (
        activeActivities.map((activity, idx) => (
          <div key={activity.id} data-tour={activity.id === tourCreatedActivityId ? 'active-activity-card' : undefined}>
            <ActivityCard activity={activity} index={idx} onEnd={() => onEndActivity(activity.id)} />
          </div>
        ))
      )}
    </div>
  )
}

type OperationHistoryPanelProps = {
  completedActivities: Activity[]
  pagination: { total: number; activeCount: number; page: number; limit: number; totalPages: number }
  historyPageLimit: number
  setHistoryPageLimit: (value: number) => void
  typeParam?: string
  loading: boolean
  title: string
  recordsText: string
  noOperationText: string
  startActivityHintText: string
  loadingText: string
  onDelete: (id: string) => void
  onOpenDetail: (activity: Activity) => void
  onFetchPage: (type: string | undefined, page: number, limit: number) => void
}

export function OperationHistoryPanel({
  completedActivities,
  pagination,
  historyPageLimit,
  setHistoryPageLimit,
  typeParam,
  loading,
  title,
  recordsText,
  noOperationText,
  startActivityHintText,
  loadingText,
  onDelete,
  onOpenDetail,
  onFetchPage,
}: OperationHistoryPanelProps) {
  return (
    <Card className="bg-eve-panel border-eve-border overflow-hidden">
      <CardHeader className="pb-4">
        <ActivityHistoryHeader
          activities={completedActivities}
          title={title}
          pageLimit={historyPageLimit}
          onPageLimitChange={setHistoryPageLimit}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {pagination.total} {recordsText}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <OperationHistoryList
          completedActivities={completedActivities}
          pagination={pagination}
          pageLimit={historyPageLimit}
          loading={loading}
          typeParam={typeParam}
          onDelete={onDelete}
          onOpenDetail={onOpenDetail}
          onFetchPage={onFetchPage}
          noOperationText={noOperationText}
          startActivityHintText={startActivityHintText}
          loadingText={loadingText}
        />
      </CardContent>
    </Card>
  )
}
