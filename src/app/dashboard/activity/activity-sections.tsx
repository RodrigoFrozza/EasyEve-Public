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
    <div className="relative min-w-0" data-tour="active-activities-section">
      <div
        className="pointer-events-none absolute -inset-x-4 -top-8 bottom-0 -z-10 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,color-mix(in_srgb,var(--acc,#34b3a4)_5%,transparent),transparent_65%)]"
        aria-hidden
      />
      <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start xl:gap-6 [&>*]:min-w-0 [&>*]:w-full">
      {activeActivities.length === 0 ? (
        <div className="col-span-full flex flex-col items-center justify-center rounded-[16px] border border-dashed border-white/[0.13] py-12 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[12px] border border-eve-accent/20 bg-eve-accent/[0.1]">
            <Target className="h-8 w-8 text-eve-accent" />
          </div>
          <h3 className="font-accent text-[15px] font-semibold text-white">{noActiveOperationsText}</h3>
          <p className="mt-2 max-w-xs text-xs text-ta-muted">{launchNewActivityText}</p>
        </div>
      ) : (
        activeActivities.map((activity, idx) => (
          <div
            key={activity.id}
            className="min-w-0 w-full"
            data-tour={activity.id === tourCreatedActivityId ? 'active-activity-card' : undefined}
          >
            <ActivityCard activity={activity} index={idx} onEnd={() => onEndActivity(activity.id)} />
          </div>
        ))
      )}
      </div>
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
    <Card className="ta-panel min-w-0 overflow-hidden">
      <CardHeader className="border-b border-white/[0.06] bg-white/[0.02] pb-4 backdrop-blur-sm">
        <ActivityHistoryHeader
          activities={completedActivities}
          title={title}
          pageLimit={historyPageLimit}
          onPageLimitChange={setHistoryPageLimit}
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-eve-muted">
            {pagination.total} {recordsText}
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="p-4 sm:p-6">
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
        </div>
      </CardContent>
    </Card>
  )
}
