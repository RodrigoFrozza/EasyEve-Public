import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Subscription {
  id: string
  userId: string
  plan: string
  status: 'active' | 'expired' | 'cancelled'
  expiresAt: string
  user: {
    name: string | null
    accountCode: string | null
  }
}

export function useAdminSubscriptions() {
  return useQuery<Subscription[]>({
    queryKey: ['admin', 'subscriptions'],
    queryFn: async () => {
      const res = await fetch('/api/admin/subscription')
      if (!res.ok) throw new Error('Failed to fetch subscriptions')
      return res.json()
    },
    staleTime: 30 * 1000,
  })
}

export function useGrantSubscription() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, plan }: { userId: string; plan: string }) => {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, plan }),
      })
      if (!res.ok) throw new Error('Failed to grant subscription')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'subscriptions'] })
    },
  })
}
