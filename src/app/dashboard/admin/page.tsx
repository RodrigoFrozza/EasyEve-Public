'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { AdminAttentionQueue } from '@/components/admin/shared/AdminAttentionQueue'
import { AdminQuickActions } from '@/components/admin/shared/AdminQuickActions'
import { useAdminStats } from '@/lib/admin/hooks/useAdminStats'
import { useTranslations } from '@/i18n/hooks'
import { Users, CreditCard, Coins, Gamepad2, KeyRound, HeartPulse, Wallet } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

export default function AdminDashboardPage() {
  const { t } = useTranslations()
  const { data: stats, isLoading } = useAdminStats()

  const quickActions = [
    {
      label: t('admin.dashboard.generateCode'),
      href: '/dashboard/admin/users/codes',
      icon: KeyRound,
    },
    {
      label: t('admin.dashboard.syncWallet'),
      description: t('admin.dashboard.syncWalletDesc'),
      href: '/dashboard/admin/finance/payments',
      icon: Wallet,
    },
    {
      label: t('admin.dashboard.viewHealth'),
      href: '/dashboard/admin/system/health',
      icon: HeartPulse,
    },
  ]

  return (
    <AdminPageContainer
      title={t('admin.nav.overview')}
      description={t('admin.dashboard.description')}
    >
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard
            title={t('admin.accounts')}
            value={stats?.totalAccounts.toLocaleString() ?? '0'}
            icon={Users}
            color="blue"
            href="/dashboard/admin/users"
          />
          <AdminMetricCard
            title={t('admin.subscription')}
            value={stats?.activeSubscriptions.toLocaleString() ?? '0'}
            icon={CreditCard}
            color="green"
            href="/dashboard/admin/users/subscriptions"
          />
          <AdminMetricCard
            title={t('admin.pendingIsk')}
            value={
              stats
                ? `${(stats.pendingIsk / 1_000_000).toFixed(1)}M`
                : '0'
            }
            icon={Coins}
            color="yellow"
            href="/dashboard/admin/finance/payments"
          />
          <AdminMetricCard
            title={t('admin.characters')}
            value={stats?.totalCharacters.toLocaleString() ?? '0'}
            icon={Gamepad2}
            color="purple"
            href="/dashboard/admin/users"
          />
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <AdminAttentionQueue />
        <AdminQuickActions title={t('admin.dashboard.quickActionsTitle')} actions={quickActions} />
      </div>
    </AdminPageContainer>
  )
}
