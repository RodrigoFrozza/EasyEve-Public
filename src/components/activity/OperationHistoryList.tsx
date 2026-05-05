'use client'

import { History, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActivityHistoryItem } from '@/components/activity/ActivityHistoryItem'
import type { Activity } from '@/lib/stores/activity-store'

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
  const showInitialLoading = loading && completedActivities.length === 0

  if (showInitialLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-eve-dark/50 mb-4">
          <History className="h-8 w-8 text-gray-600 animate-pulse" />
        </div>
        <p className="text-gray-400 font-medium">{loadingText}</p>
      </div>
    )
  }

  if (completedActivities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="p-4 rounded-full bg-eve-dark/50 mb-4">
          <History className="h-8 w-8 text-gray-600" />
        </div>
        <p className="text-gray-400 font-medium">{noOperationText}</p>
        <p className="text-gray-600 text-sm mt-1">{startActivityHintText}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-3">
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
        <div className="mt-6 pt-4 border-t border-eve-border/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[10px] text-zinc-500 uppercase font-bold tracking-widest">
            Showing <span className="text-zinc-300">{(pagination.page - 1) * pagination.limit + 1}</span> - <span className="text-zinc-300">{Math.min(pagination.page * pagination.limit, pagination.total)}</span> of <span className="text-zinc-300">{pagination.total}</span> records
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => onFetchPage(typeParam, pagination.page - 1, pageLimit)}
              className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 px-3"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>

            <div className="text-[10px] font-bold text-zinc-400 px-2">
              {pagination.page} / {pagination.totalPages}
            </div>

            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => onFetchPage(typeParam, pagination.page + 1, pageLimit)}
              className="bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 px-3"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
