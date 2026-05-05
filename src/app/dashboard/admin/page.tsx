'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { AdminStatsCard } from '@/components/admin/shared/AdminStatsCard'
import { useAdminStats } from '@/lib/admin/hooks/useAdminStats'
import { Users, CreditCard, Coins, Gamepad2 } from 'lucide-react'

export default function AdminDashboardPage() {
  const { data: stats, isLoading } = useAdminStats()

  if (isLoading) {
    return (
      <AdminPageContainer title="Dashboard" description="Loading...">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-24 bg-eve-panel/60 animate-pulse rounded-lg" />
          ))}
        </div>
      </AdminPageContainer>
    )
  }

  return (
    <AdminPageContainer 
      title="Dashboard"
      description="Overview of platform statistics and health"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatsCard
          title="Total Accounts"
          value={stats?.totalAccounts.toLocaleString() || '0'}
          icon={Users}
          color="blue"
        />
        <AdminStatsCard
          title="Active Subscriptions"
          value={stats?.activeSubscriptions.toLocaleString() || '0'}
          icon={CreditCard}
          color="green"
        />
        <AdminStatsCard
          title="Pending ISK"
          value={stats ? `${(stats.pendingIsk / 1000000).toFixed(1)}M` : '0M'}
          icon={Coins}
          color="yellow"
        />
        <AdminStatsCard
          title="Linked Characters"
          value={stats?.totalCharacters.toLocaleString() || '0'}
          icon={Gamepad2}
          color="purple"
        />
      </div>
    </AdminPageContainer>
  )
}
