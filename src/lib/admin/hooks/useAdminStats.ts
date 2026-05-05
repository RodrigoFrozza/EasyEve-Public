import { useQuery } from '@tanstack/react-query'

export interface AdminStats {
  totalAccounts: number
  activeSubscriptions: number
  pendingIsk: number
  totalCharacters: number
}

export function useAdminStats() {
  return useQuery<AdminStats>({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const res = await fetch('/api/admin/stats')
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
  })
}
