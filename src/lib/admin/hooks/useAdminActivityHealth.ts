import { useQuery } from '@tanstack/react-query'

export type ActivityHealthByType = {
  type: string
  total: number
  active: number
  completed: number
  staleActive: number
}

export type ActivityHealthResponse = {
  totalTracked: number
  byType: ActivityHealthByType[]
  generatedAt: string
}

export function useAdminActivityHealth() {
  return useQuery<ActivityHealthResponse>({
    queryKey: ['admin', 'activity-health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity-health')
      if (!res.ok) throw new Error('Failed to fetch activity health')
      return res.json()
    },
    refetchInterval: 30_000,
  })
}

export function useAdminActivityMetrics() {
  return useQuery({
    queryKey: ['admin', 'activity-metrics'],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity-metrics')
      if (!res.ok) throw new Error('Failed to fetch activity metrics')
      return res.json()
    },
    refetchInterval: 60_000,
  })
}
