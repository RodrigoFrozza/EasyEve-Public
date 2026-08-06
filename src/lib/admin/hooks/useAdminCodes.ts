import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface AdminCode {
  id: string
  code: string
  type: string
  used: boolean
  isInvalidated: boolean
  usedById: string | null
  createdAt: string
  usedBy?: {
    name: string | null
    accountCode: string | null
  }
}

export function useAdminCodes(page = 1, limit = 50) {
  return useQuery<{ codes: AdminCode[]; pagination: { total: number; pages: number } }>({
    queryKey: ['admin', 'codes', page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      })
      const res = await fetch(`/api/admin/codes?${params}`)
      if (!res.ok) throw new Error('Failed to fetch codes')
      return res.json()
    },
    staleTime: 30 * 1000,
  })
}

export function useGenerateCodes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ count, type }: { count: number; type: string }) => {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, type }),
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: 'Failed to generate codes' }))
        throw new Error(error.error || 'Failed to generate codes')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes'] })
    },
  })
}

export function useDeleteCode() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (codeId: string) => {
      const res = await fetch(`/api/admin/codes?id=${codeId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete code')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'codes'] })
    },
  })
}
