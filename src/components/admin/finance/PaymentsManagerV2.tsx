'use client'

import { useState } from 'react'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminPayments, useApprovePayment, useRejectPayment } from '@/lib/admin/hooks/useAdminPayments'
import { Button } from '@/components/ui/button'
import { CheckCircle, XCircle, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from 'lucide-react'
import type { AdminPayment } from '@/lib/admin/hooks/useAdminPayments'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { formatISK } from '@/lib/utils'

export function PaymentsManagerV2() {
  const { t } = useTranslations()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [syncing, setSyncing] = useState(false)
  const limit = 20

  const { data, isLoading, refetch } = useAdminPayments(page, limit, search)
  const approveMutation = useApprovePayment()
  const rejectMutation = useRejectPayment()

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id)
      toast.success(t('admin.paymentApproved'))
    } catch {
      toast.error(t('admin.paymentApproveError'))
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync(id)
      toast.success(t('admin.reject') + ' OK')
    } catch {
      toast.error(t('admin.paymentApproveError'))
    }
  }

  const handleSyncWallet = async () => {
    if (!confirm(t('admin.payments.syncConfirm'))) return
    setSyncing(true)
    try {
      const res = await fetch('/api/admin/payments/sync', { method: 'POST' })
      if (!res.ok) throw new Error('sync failed')
      toast.success(t('admin.payments.syncSuccess'))
      refetch()
    } catch {
      toast.error(t('admin.payments.syncError'))
    } finally {
      setSyncing(false)
    }
  }

  const columns = [
    {
      key: 'user',
      header: t('admin.user'),
      render: (payment: AdminPayment) => (
        <div>
          <p className="text-sm font-medium">{payment.user.name || t('admin.noName')}</p>
          <p className="text-xs text-muted-foreground">{payment.user.accountCode}</p>
        </div>
      ),
    },
    {
      key: 'payer',
      header: t('admin.payer'),
      render: (payment: AdminPayment) => (
        <span className="text-sm">{payment.payerCharacterName || t('admin.notLinked')}</span>
      ),
    },
    {
      key: 'amount',
      header: t('admin.value'),
      render: (payment: AdminPayment) => (
        <span className="text-sm font-medium tabular-nums">{formatISK(payment.amount)}</span>
      ),
    },
    {
      key: 'status',
      header: t('admin.status'),
      render: (payment: AdminPayment) => (
        <AdminBadge
          status={
            payment.status === 'approved'
              ? 'success'
              : payment.status === 'rejected'
                ? 'error'
                : 'warning'
          }
        >
          {payment.status}
        </AdminBadge>
      ),
    },
    {
      key: 'date',
      header: t('admin.dateTime'),
      render: (payment: AdminPayment) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {new Date(payment.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.action'),
      className: 'text-right',
      render: (payment: AdminPayment) =>
        payment.status === 'pending' ? (
          <div className="flex justify-end gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-600"
              onClick={() => handleApprove(payment.id)}
              disabled={approveMutation.isPending}
              title={t('admin.approve')}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => handleReject(payment.id)}
              disabled={rejectMutation.isPending}
              title={t('admin.reject')}
            >
              <XCircle className="h-4 w-4" />
            </Button>
          </div>
        ) : null,
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.searchPlaceholder')}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncWallet}
            disabled={syncing}
            className="gap-2"
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {t('admin.payments.syncWallet')}
          </Button>
        }
      />

      <AdminDataTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(p) => p.id}
        emptyMessage={t('admin.noPaymentRecords')}
      />

      {data?.pagination && (
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
