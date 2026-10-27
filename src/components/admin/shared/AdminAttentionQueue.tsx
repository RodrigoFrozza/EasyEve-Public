'use client'

import Link from 'next/link'
import { AlertCircle, ChevronRight, CreditCard, Shield, UserPlus, CalendarClock } from 'lucide-react'
import { useAdminPendingCounts } from '@/lib/admin/hooks/useAdminPendingCounts'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type QueueItem = {
  label: string
  count: number
  href: string
  icon: React.ElementType
  urgent?: boolean
}

export function AdminAttentionQueue() {
  const { t } = useTranslations()
  const { data, isLoading } = useAdminPendingCounts()

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-40" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const items: QueueItem[] = [
    {
      label: t('admin.dashboard.pendingPayments'),
      count: data?.pendingPayments ?? 0,
      href: '/dashboard/admin/finance/payments',
      icon: CreditCard,
      urgent: (data?.pendingPayments ?? 0) > 0,
    },
    {
      label: t('admin.dashboard.pendingTesters'),
      count: data?.pendingTesterApplications ?? 0,
      href: '/dashboard/admin/users/tester-applications',
      icon: UserPlus,
      urgent: (data?.pendingTesterApplications ?? 0) > 0,
    },
    {
      label: t('admin.dashboard.recentSecurity'),
      count: data?.securityEvents24h ?? 0,
      href: '/dashboard/admin/security',
      icon: Shield,
    },
    {
      label: t('admin.dashboard.schedulerIssues'),
      count: data?.schedulerUnhealthy ? 1 : 0,
      href: '/dashboard/admin/system/schedules',
      icon: CalendarClock,
      urgent: data?.schedulerUnhealthy,
    },
  ]

  const activeItems = items.filter((i) => i.count > 0 || i.urgent)

  return (
    <div className="space-y-3">
      <h2 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-eve-accent" />
        {t('admin.dashboard.attentionTitle')}
      </h2>

      {activeItems.length === 0 ? (
        <p className="text-sm text-ta-muted rounded-[14px] border border-dashed border-white/[0.13] p-6 text-center">
          {t('admin.dashboard.noAttention')}
        </p>
      ) : (
        <ul className="space-y-2">
          {activeItems.map((item) => {
            const Icon = item.icon
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center justify-between gap-3 rounded-[10px] border px-4 py-3 transition-colors',
                    item.urgent
                      ? 'border-[rgba(224,169,74,.24)] bg-[rgba(224,169,74,.09)] hover:border-[rgba(224,169,74,.4)]'
                      : 'border-white/[0.06] bg-ta-inset hover:border-eve-accent/40'
                  )}
                >
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon className={cn('h-4 w-4 shrink-0', item.urgent ? 'text-ta-warning' : 'text-eve-accent')} />
                    <span className="font-accent text-[13px] font-semibold text-ta-bright">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        'font-sans tabular-nums text-sm font-bold',
                        item.urgent ? 'text-ta-warning' : 'text-ta-bright'
                      )}
                    >
                      {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ta-muted" />
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
