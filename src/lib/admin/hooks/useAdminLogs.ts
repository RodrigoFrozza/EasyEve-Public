import { useQuery } from '@tanstack/react-query'

export interface AdminLog {
  id: string
  userId: string
  level: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  createdAt: string
  user: {
    name: string | null
    accountCode: string | null
  }
}

export function useAdminLogs(page = 1, limit = 50) {
  return useQuery<{ items: AdminLog[]; pagination: { total: number; pages: number } }>({
    queryKey: ['admin', 'logs', page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      const res = await fetch(`/api/admin/logs?${params}`)
      if (!res.ok) throw new Error('Failed to fetch logs')
      return res.json()
    },
    refetchInterval: 30 * 1000,
    staleTime: 25 * 1000,
  })
}
