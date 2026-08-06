import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface CarouselItem {
  id: string
  imageUrl: string
  altText: string | null
  link: string | null
  order: number
  active: boolean
  createdAt: string
}

export function useAdminCarousel() {
  return useQuery<CarouselItem[]>({
    queryKey: ['admin', 'carousel'],
    queryFn: async () => {
      const res = await fetch('/api/admin/homepage-carousel')
      if (!res.ok) throw new Error('Failed to fetch carousel')
      const data = await res.json()
      return data.items || data
    },
    staleTime: 30 * 1000,
  })
}

export function useCreateCarouselItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { imageUrl: string; altText: string; link: string }) => {
      const res = await fetch('/api/admin/homepage-carousel/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create carousel item')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'carousel'] })
    },
  })
}

export function useDeleteCarouselItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/homepage-carousel/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'carousel'] })
    },
  })
}
