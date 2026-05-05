import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AdminPayment {
  id: string
  amount: number
  status: 'pending' | 'approved' | 'rejected'
  payerCharacterName: string | null
  user: {
    id: string
    name: string | null
    accountCode: string | null
  }
  createdAt: string
}

export function useAdminPayments(page = 1, limit = 20, search?: string) {
  return useQuery<{ items: AdminPayment[]; pagination: { total: number; pages: number } }>({
    queryKey: ['admin', 'payments', page, limit, search],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
      })
      const res = await fetch(`/api/admin/payments?${params}`)
      if (!res.ok) throw new Error('Failed to fetch payments')
      return res.json()
    },
    staleTime: 10 * 1000,
  })
}

export function useApprovePayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/admin/payments/${paymentId}/approve`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to approve payment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
  })
}

export function useRejectPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await fetch(`/api/admin/payments/${paymentId}/reject`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to reject payment')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'payments'] })
    },
  })
}
