'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminLogs } from '@/lib/admin/hooks/useAdminLogs'
import type { AdminLog } from '@/lib/admin/hooks/useAdminLogs'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Trash2, ExternalLink } from 'lucide-react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

export function GlobalLogsV2() {
  const { t } = useTranslations()
  const searchParams = useSearchParams()
  const filterUserId = searchParams.get('userId')
  const [page, setPage] = useState(1)
  const [cleaning, setCleaning] = useState(false)
  const limit = 50
  const { data, isLoading, refetch } = useAdminLogs(page, limit)

  const items = useMemo(() => {
    const raw = data?.items || []
    if (!filterUserId) return raw
    return raw.filter((log) => log.userId === filterUserId)
  }, [data?.items, filterUserId])

  const handleCleanup = async () => {
    if (!confirm(t('admin.logs.cleanupConfirm'))) return
    setCleaning(true)
    try {
      const res = await fetch('/api/admin/logs/cleanup', { method: 'POST' })
      if (!res.ok) throw new Error('cleanup failed')
      toast.success(t('admin.logs.cleanupSuccess'))
      refetch()
    } catch {
      toast.error(t('admin.errorPrefix') + 'cleanup')
    } finally {
      setCleaning(false)
    }
  }

  const columns = [
    {
      key: 'level',
      header: t('admin.logs.level') ?? 'Level',
      className: 'w-24',
      render: (log: AdminLog) => (
        <AdminBadge
          status={
            log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : 'info'
          }
        >
          {log.level}
        </AdminBadge>
      ),
    },
    {
      key: 'user',
      header: t('admin.user'),
      render: (log: AdminLog) => (
        <div>
          <p className="text-sm font-medium">{log.user?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{log.user?.accountCode || log.userId}</p>
        </div>
      ),
    },
    {
      key: 'message',
      header: t('admin.logs.message') ?? 'Message',
      render: (log: AdminLog) => (
        <span className="text-sm text-foreground line-clamp-2 max-w-md">{log.message}</span>
      ),
    },
    {
      key: 'url',
      header: 'URL',
      className: 'max-w-xs',
      render: (log: AdminLog) => (
        <span className="text-xs text-muted-foreground truncate block max-w-[200px]">
          {log.url || '—'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: t('admin.createdAt'),
      className: 'w-36',
      render: (log: AdminLog) => (
        <span className="text-sm text-muted-foreground">
          <FormattedDate date={log.createdAt} />
        </span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {filterUserId && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
            <span>{t('admin.logs.userFilterBanner')}: {filterUserId}</span>
            <Button variant="link" size="sm" className="h-auto p-0 gap-1" asChild>
              <Link href={`/dashboard/admin/logs/${filterUserId}`}>
                {t('admin.logs.viewUserLogs')}
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCleanup}
          disabled={cleaning}
          className="gap-2 ml-auto"
        >
          <Trash2 className="h-4 w-4" />
          {t('admin.logs.cleanup')}
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        data={items}
        keyExtractor={(log) => log.id}
        emptyMessage={t('admin.logs.empty') ?? 'No logs'}
      />

      {data?.pagination && !filterUserId && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {data.pagination.total} · {page}/{data.pagination.pages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
