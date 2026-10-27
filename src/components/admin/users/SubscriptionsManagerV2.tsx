'use client'

import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

interface Subscription {
  id: string
  name: string | null
  accountCode: string | null
  subscriptionEnd: string
  hasPremium: boolean
}

export function SubscriptionsManagerV2() {
  const { t } = useTranslations()
  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription')
      if (!res.ok) throw new Error('Failed')
      return res.json()
    },
    staleTime: 30_000,
  })

  const columns = [
    {
      key: 'user',
      header: t('admin.user'),
      render: (item: Subscription) => (
        <div>
          <p className="text-sm font-medium">{item.name || t('admin.noName')}</p>
          <p className="text-xs text-muted-foreground">{item.accountCode || '—'}</p>
        </div>
      ),
    },
    {
      key: 'status',
      header: t('admin.status'),
      render: (item: Subscription) => (
        <AdminBadge status={item.hasPremium ? 'success' : 'error'}>
          {item.hasPremium ? t('admin.filterActive') : t('admin.filterExpired')}
        </AdminBadge>
      ),
    },
    {
      key: 'expires',
      header: t('admin.expires'),
      render: (item: Subscription) => (
        <span className="text-sm tabular-nums">
          {new Date(item.subscriptionEnd).toLocaleDateString()}
        </span>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <AdminDataTable
      columns={columns}
      data={subscriptions || []}
      keyExtractor={(item) => item.id}
      emptyMessage={t('admin.noPremiumUsers')}
    />
  )
}
