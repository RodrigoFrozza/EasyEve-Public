import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface NewsItem {
  id: string
  title: string
  content: string
  imageUrl?: string
  category: string
  authorId?: string
  createdAt: string
  published: boolean
}

export function useAdminNews() {
  return useQuery<NewsItem[]>({
    queryKey: ['admin', 'news'],
    queryFn: async () => {
      const res = await fetch('/api/news')
      if (!res.ok) throw new Error('Failed to fetch news')
      return res.json()
    },
    staleTime: 60 * 1000,
  })
}

export function useCreateNews() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<NewsItem>) => {
      const res = await fetch('/api/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to create news')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
    },
  })
}

export function useUpdateNews() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<NewsItem> & { id: string }) => {
      const res = await fetch(`/api/news/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('Failed to update news')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
    },
  })
}

export function useDeleteNews() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/news/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete news')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'news'] })
    },
  })
}
