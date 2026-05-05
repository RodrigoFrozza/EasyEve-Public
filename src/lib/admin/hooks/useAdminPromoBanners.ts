import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface PromoBanner {
  id: string
  title: string
  description: string
  badgeText: string | null
  buttonText: string
  imageUrl: string | null
  targetSegment: string
  maxAccountAgeDays: number | null
  priority: number
  dismissible: boolean
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
  stats?: {
    claimCount: number
    dismissCount: number
    redeemedCount: number
  }
}

export function useAdminPromoBanners() {
  return useQuery<PromoBanner[]>({
    queryKey: ['admin', 'promo-banners'],
    queryFn: async () => {
      const res = await fetch('/api/admin/promo-banners')
      if (!res.ok) throw new Error('Failed to fetch banners')
      const data = await res.json()
      return data.items || data
    },
    staleTime: 30 * 1000,
  })
}

export function useCreatePromoBanner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<PromoBanner>) => {
      const res = await fetch('/api/admin/promo-banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create banner')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-banners'] })
    },
  })
}

export function useUpdatePromoBanner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<PromoBanner> & { id: string }) => {
      const res = await fetch(`/api/admin/promo-banners/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update banner')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-banners'] })
    },
  })
}

export function useDeletePromoBanner() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/promo-banners/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'promo-banners'] })
    },
  })
}
