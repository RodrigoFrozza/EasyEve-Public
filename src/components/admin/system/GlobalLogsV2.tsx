'use client'

import { useState } from 'react'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminLogs } from '@/lib/admin/hooks/useAdminLogs'
import type { AdminLog } from '@/lib/admin/hooks/useAdminLogs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, AlertTriangle, Info, Terminal } from 'lucide-react'
import { FormattedDate } from '@/components/shared/FormattedDate'

export function GlobalLogsV2() {
  const [page, setPage] = useState(1)
  const limit = 50
  const { data, isLoading } = useAdminLogs(page, limit)

  const columns = [
    {
      key: 'level',
      header: 'Level',
      render: (log: AdminLog) => (
        <AdminBadge status={
          log.level === 'error' ? 'error' : 
          log.level === 'warn' ? 'warning' : 'info'
        }>
          {log.level.toUpperCase()}
        </AdminBadge>
      ),
      className: 'w-24',
    },
    {
      key: 'user',
      header: 'User',
      render: (log: AdminLog) => (
        <span className="text-sm text-eve-text">
          {log.user?.name || 'Unknown'} ({log.user?.accountCode || 'N/A'})
        </span>
      ),
    },
    {
      key: 'message',
      header: 'Message',
      render: (log: AdminLog) => (
        <span className="text-sm text-eve-text/80 truncate max-w-md block">
          {log.message}
        </span>
      ),
    },
    {
      key: 'url',
      header: 'URL',
      render: (log: AdminLog) => (
        <span className="text-xs text-eve-text/40 truncate max-w-xs block">
          {log.url || '-'}
        </span>
      ),
      className: 'max-w-xs',
    },
    {
      key: 'createdAt',
      header: 'Created',
      render: (log: AdminLog) => (
        <span className="text-xs text-eve-text/60">
          <FormattedDate date={log.createdAt} />
        </span>
      ),
      className: 'w-32',
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-12 bg-eve-panel/60 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(log) => log.id}
        emptyMessage="No logs found"
      />

      {data?.pagination && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-eve-text/60">
            Total: {data.pagination.total} logs
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-eve-text/60 px-2">
              {page} / {data.pagination.pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= data.pagination.pages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
