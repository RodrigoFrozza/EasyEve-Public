import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AdminAccount {
  id: string
  name: string | null
  email: string
  role: string
  isBlocked: boolean
  isTester: boolean
  accountCode: string | null
  createdAt: string | null
  subscriptionEnd: string | null
  lastLoginAt: string | null
  discordId: string | null
  discordName: string | null
  allowedActivities: string[]
  characters: Array<{ id: string; name: string; isMain: boolean }>
  payments?: Array<{
    id: string
    amount: number
    status: string
    createdAt: string
    payerCharacterName: string | null
    journalId: string | null
  }>
  medals?: Array<{
    id: string
    name: string
    icon: string
    tier: string
    count: number
    awardedAt: string
  }>
  friends?: Array<{
    id: string
    name: string
    addedAt: string
  }>
  _count: {
    characters: number
  }
}

export function useAdminAccounts(page = 1, limit = 10, search?: string, filter?: string) {
  return useQuery<{ accounts: AdminAccount[]; pagination: { total: number; pages: number } }>({
    queryKey: ['admin', 'accounts', page, limit, search, filter],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        ...(search && { search }),
        ...(filter && { filter }),
      })
      const res = await fetch(`/api/admin/accounts?${params}`)
      if (!res.ok) throw new Error('Failed to fetch accounts')
      return res.json()
    },
    staleTime: 10 * 1000,
  })
}


export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<AdminAccount> & { userId: string }) => {
      const res = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update account')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
  })
}

export function useBlockAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, isBlocked, blockReason }: { userId: string; isBlocked: boolean; blockReason?: string }) => {
      const res = await fetch(`/api/admin/accounts/${userId}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked, blockReason }),
      })
      if (!res.ok) throw new Error('Failed to block/unblock account')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/admin/accounts?userId=${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete account')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
  })
}
