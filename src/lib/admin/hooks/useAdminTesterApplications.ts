import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface TesterApplication {
  id: string
  userId: string
  description: string
  status: 'pending' | 'approved' | 'rejected'
  reviewNotes: string | null
  cooldownUntil: string | null
  reviewedAt: string | null
  createdAt: string
  user: {
    id: string
    name: string | null
    accountCode: string | null
    isTester: boolean
  }
}

export function useAdminTesterApplications() {
  return useQuery<{ applications: TesterApplication[] }>({
    queryKey: ['admin', 'tester-applications'],
    queryFn: async () => {
      const res = await fetch('/api/admin/tester-applications')
      if (!res.ok) throw new Error('Failed to fetch applications')
      return res.json()
    },
    staleTime: 10 * 1000,
  })
}

interface ReviewVariables {
  id: string
  reviewNotes?: string
}

async function postReview(action: 'approve' | 'reject', { id, reviewNotes }: ReviewVariables) {
  const res = await fetch(`/api/admin/tester-applications/${id}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reviewNotes }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const zodDetail = Array.isArray(body?.details)
      ? body.details
          .map((d: { path?: string; message?: string }) =>
            [d?.path, d?.message].filter(Boolean).join(': '),
          )
          .filter(Boolean)
          .join('; ')
      : null
    const message =
      zodDetail ||
      body?.error ||
      body?.message ||
      `Failed to ${action} application`
    throw new Error(message)
  }
  return res.json()
}

export function useApproveTester() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: ReviewVariables) => postReview('approve', variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tester-applications'] })
    },
  })
}

export function useRejectTester() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (variables: ReviewVariables) => postReview('reject', variables),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tester-applications'] })
    },
  })
}
