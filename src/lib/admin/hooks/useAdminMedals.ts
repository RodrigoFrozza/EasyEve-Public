import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Medal {
  id: string
  name: string
  description: string
  icon: string
  tier: string
  type: string
  isActive: boolean
  criteria?: string
  awardCount?: number
  uniqueRecipients?: number
}

export function useAdminMedals(includeStats = false) {
  return useQuery<{ medals: Medal[] }>({
    queryKey: ['admin', 'medals', { includeStats }],
    queryFn: async () => {
      const res = await fetch(`/api/admin/medals${includeStats ? '?includeStats=1' : ''}`)
      if (!res.ok) throw new Error('Failed to fetch medals')
      return res.json()
    },
    staleTime: 30 * 1000,
  })
}

export function useCreateMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Medal>) => {
      const res = await fetch('/api/admin/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...data }),
      })
      if (!res.ok) throw new Error('Failed to create')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals'] })
    },
  })
}

export function useUpdateMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Medal> & { id: string }) => {
      const res = await fetch('/api/admin/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', medalId: id, ...data }),
      })
      if (!res.ok) throw new Error('Failed to update')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals'] })
    },
  })
}

export function useToggleMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch('/api/admin/medals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', medalId: id, isActive }),
      })
      if (!res.ok) throw new Error('Failed to toggle')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals'] })
    },
  })
}


export function useDeleteMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (medalId: string) => {
      const res = await fetch(`/api/admin/medals?id=${medalId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete medal')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals'] })
    },
  })
}

export function useUserMedals(userId: string | undefined) {
  return useQuery<{ awardedMedals: any[]; availableMedals: Medal[] }>({
    queryKey: ['admin', 'medals', 'user', userId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/medals/${userId}`)
      if (!res.ok) throw new Error('Failed to fetch user medals')
      return res.json()
    },
    enabled: !!userId,
  })
}

export function useAwardMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, medalId, period }: { userId: string; medalId: string; period?: string }) => {
      const res = await fetch(`/api/admin/medals/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medalId, period }),
      })
      if (!res.ok) throw new Error('Failed to award medal')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals', 'user', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
  })
}

export function useRevokeMedal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, awardId }: { userId: string; awardId: string }) => {
      const res = await fetch(`/api/admin/medals/${userId}?awardId=${awardId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to revoke medal')
      return res.json()
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'medals', 'user', variables.userId] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'accounts'] })
    },
  })
}
