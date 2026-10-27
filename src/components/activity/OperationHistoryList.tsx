'use client'

import { History, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityHistoryItem } from '@/components/activity/ActivityHistoryItem'
import type { Activity } from '@/lib/stores/activity-store'
import { useTranslations } from '@/i18n/hooks'

interface OperationHistoryListProps {
  completedActivities: Activity[]
  pagination: { total: number; activeCount: number; page: number; limit: number; totalPages: number }
  pageLimit: number
  loading?: boolean
  typeParam?: string
  onDelete: (id: string) => void
  onOpenDetail: (activity: Activity) => void
  onFetchPage: (type: string | undefined, page: number, limit: number) => void
  noOperationText: string
  startActivityHintText: string
  loadingText?: string
}

export function OperationHistoryList({
  completedActivities,
  pagination,
  pageLimit,
  loading = false,
  typeParam,
  onDelete,
  onOpenDetail,
  onFetchPage,
  noOperationText,
  startActivityHintText,
  loadingText = 'Loading history...',
}: OperationHistoryListProps) {
  const { t } = useTranslations()
  const showInitialLoading = loading && completedActivities.length === 0

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-eve-border/30 bg-eve-dark py-12 text-center">
        <div className="mb-4 rounded-sm border border-eve-border/20 bg-eve-panel p-4">
          <History className="h-8 w-8 animate-pulse text-eve-muted" />
        </div>
        <p className="text-[10px] font-medium text-eve-muted">{loadingText}</p>
      </div>
    )
  }

  if (completedActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-sm border border-dashed border-eve-border/30 bg-eve-dark py-12 text-center">
        <div className="mb-4 rounded-sm border border-eve-border/20 bg-eve-panel p-4">
          <History className="h-8 w-8 text-eve-muted" />
        </div>
        <p className="text-xs font-medium text-eve-text">{noOperationText}</p>
        <p className="mt-2 text-[10px] text-eve-muted">{startActivityHintText}</p>
      </div>
    )
  }

  const from = (pagination.page - 1) * pagination.limit + 1
  const to = Math.min(pagination.page * pagination.limit, pagination.total)

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {completedActivities.map((activity) => (
          <ActivityHistoryItem
            key={activity.id}
            activity={activity}
            onDelete={onDelete}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-eve-border/30 pt-4 sm:flex-row">
          <p className="text-[11px] text-eve-muted">
            {t('activity.tracker.history.showingRange', {
              from,
              to,
              total: pagination.total,
            })}
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onFetchPage(typeParam, pagination.page - 1, pageLimit)}
              className="h-8 rounded-sm border-eve-border bg-eve-dark px-3 text-xs text-eve-muted hover:border-eve-accent/40 hover:bg-eve-accent/10 hover:text-eve-accent"
            >
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
              {t('activity.tracker.history.prevPage')}
            </Button>

            <span className="min-w-[4rem] rounded-sm border border-eve-border/40 bg-eve-dark px-3 py-1.5 text-center text-xs font-medium tabular-nums text-eve-text">
              {pagination.page} / {pagination.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onFetchPage(typeParam, pagination.page + 1, pageLimit)}
              className="h-8 rounded-sm border-eve-border bg-eve-dark px-3 text-xs text-eve-muted hover:border-eve-accent/40 hover:bg-eve-accent/10 hover:text-eve-accent"
            >
              {t('activity.tracker.history.nextPage')}
              <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
