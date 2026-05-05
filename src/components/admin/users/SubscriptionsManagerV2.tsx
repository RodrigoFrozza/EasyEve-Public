'use client'

import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useQuery } from '@tanstack/react-query'

interface Subscription {
  id: string
  name: string | null
  accountCode: string | null
  subscriptionEnd: string
  hasPremium: boolean
}

export function SubscriptionsManagerV2() {
  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 30 * 1000,
  })

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (item: Subscription) => (
        <div>
          <p className="text-eve-text">{item.name || 'Unknown'}</p>
          <p className="text-xs text-eve-text/40">{item.accountCode}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: Subscription) => (
        <AdminBadge status={item.hasPremium ? 'success' : 'error'}>
          {item.hasPremium ? 'Active' : 'Expired'}
        </AdminBadge>
      ),
    },
    {
      key: 'expires',
      header: 'Expires',
      render: (item: Subscription) => (
        <span className="text-sm text-eve-text/60">
          {new Date(item.subscriptionEnd).toLocaleDateString()}
        </span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3].map(i => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminTable
        columns={columns}
        data={subscriptions || []}
        keyExtractor={(item) => item.id}
        emptyMessage="No active subscriptions"
      />
    </div>
  )
}
