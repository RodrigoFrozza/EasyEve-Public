import { useQuery } from '@tanstack/react-query'

export interface SystemHealth {
  cpu: { usage: number; cores: number }
  memory: { used: number; total: number; percentage: number }
  uptime: number
  timestamp: string
}

export function useAdminHealth() {
  return useQuery<SystemHealth>({
    queryKey: ['admin', 'health'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system-health')
      if (!res.ok) throw new Error('Failed to fetch health data')
      const data = await res.json()
      return {
        ...data,
        uptime: data.uptime?.seconds ?? 0,
        cpu: {
          ...data.cpu,
          usage: parseFloat(data.cpu?.usage) || 0,
        },
        memory: {
          ...data.memory,
          percentage: parseFloat(data.memory?.percentage) || 0,
        },
      }
    },
    refetchInterval: 5 * 1000,
    staleTime: 4 * 1000,
  })
}
