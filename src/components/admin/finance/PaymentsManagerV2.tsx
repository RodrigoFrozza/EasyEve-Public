'use client'

import { useState } from 'react'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminPayments, useApprovePayment, useRejectPayment } from '@/lib/admin/hooks/useAdminPayments'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckCircle, XCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import type { AdminPayment } from '@/lib/admin/hooks/useAdminPayments'
import { toast } from 'sonner'

export function PaymentsManagerV2() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const limit = 20

  const { data, isLoading } = useAdminPayments(page, limit, search)
  const approveMutation = useApprovePayment()
  const rejectMutation = useRejectPayment()

  const handleApprove = async (id: string) => {
    try {
      await approveMutation.mutateAsync(id)
      toast.success('Payment approved')
    } catch {
      toast.error('Failed to approve payment')
    }
  }

  const handleReject = async (id: string) => {
    try {
      await rejectMutation.mutateAsync(id)
      toast.success('Payment rejected')
    } catch {
      toast.error('Failed to reject payment')
    }
  }

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (payment: AdminPayment) => (
        <div>
          <p className="font-medium text-eve-text">{payment.user.name || 'Unknown'}</p>
          <p className="text-xs text-eve-text/40">{payment.user.accountCode}</p>
        </div>
      ),
    },
    {
      key: 'payer',
      header: 'Payer',
      render: (payment: AdminPayment) => (
        <span className="text-sm text-eve-text/60">{payment.payerCharacterName || '-'}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (payment: AdminPayment) => (
        <span className="font-medium text-eve-text">{(payment.amount / 1000000).toFixed(1)}M ISK</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (payment: AdminPayment) => (
        <AdminBadge status={
          payment.status === 'approved' ? 'success' :
          payment.status === 'rejected' ? 'error' : 'warning'
        }>
          {payment.status}
        </AdminBadge>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (payment: AdminPayment) => (
        <span className="text-xs text-eve-text/60">
          {new Date(payment.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (payment: AdminPayment) => (
        <div className="flex gap-2">
          {payment.status === 'pending' && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApprove(payment.id)}
                disabled={approveMutation.isPending}
                className="text-green-400 border-green-400/30 hover:bg-green-400/10"
              >
                <CheckCircle className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(payment.id)}
                disabled={rejectMutation.isPending}
                className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              >
                <XCircle className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Search className="w-4 h-4 text-eve-text/40" />
        <Input
          placeholder="Search payments..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm bg-eve-panel/60 border-eve-border/30"
        />
      </div>

      <AdminTable
        columns={columns}
        data={data?.items || []}
        keyExtractor={(p) => p.id}
        emptyMessage="No payments found"
      />

      {data?.pagination && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-eve-text/60">
            Total: {data.pagination.total} payments
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-eve-text/60 px-2">{page} / {data.pagination.pages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
