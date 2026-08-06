import { useQuery } from '@tanstack/react-query'

export interface AdminPendingCounts {
  pendingPayments: number
  pendingTesterApplications: number
  securityEvents24h: number
  schedulerUnhealthy: boolean
}

export function useAdminPendingCounts() {
  return useQuery<AdminPendingCounts>({
    queryKey: ['admin', 'pending-counts'],
    queryFn: async () => {
      const [paymentsRes, testersRes, securityRes, schedulerRes] = await Promise.all([
        fetch('/api/admin/payments?limit=100'),
        fetch('/api/admin/tester-applications?status=pending'),
        fetch('/api/admin/security?limit=50'),
        fetch('/api/admin/scripts/scheduler/health'),
      ])

      let pendingPayments = 0
      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        const items = data.items ?? data.payments ?? []
        pendingPayments = items.filter((p: { status?: string }) => p.status === 'pending').length
      }

      let pendingTesterApplications = 0
      if (testersRes.ok) {
        const data = await testersRes.json()
        pendingTesterApplications = (data.applications ?? []).length
      }

      let securityEvents24h = 0
      if (securityRes.ok) {
        const data = await securityRes.json()
        const events = data.events ?? data.items ?? []
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        securityEvents24h = events.filter(
          (e: { createdAt?: string }) =>
            e.createdAt && new Date(e.createdAt).getTime() > cutoff
        ).length
      }

      let schedulerUnhealthy = false
      if (schedulerRes.ok) {
        const data = await schedulerRes.json()
        schedulerUnhealthy =
          data.status === 'stale' ||
          data.status === 'never' ||
          (data.overdueSchedules ?? 0) > 0
      }

      return {
        pendingPayments,
        pendingTesterApplications,
        securityEvents24h,
        schedulerUnhealthy,
      }
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}
