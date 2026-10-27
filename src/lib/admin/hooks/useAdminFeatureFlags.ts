import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export type FeatureFlagsMap = Record<string, boolean>

export function useAdminFeatureFlags() {
  return useQuery<FeatureFlagsMap>({
    queryKey: ['admin', 'feature-flags'],
    queryFn: async () => {
      const res = await fetch('/api/admin/feature-flags')
      if (!res.ok) throw new Error('Failed to fetch feature flags')
      return res.json()
    },
  })
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, isEnabled }: { name: string; isEnabled: boolean }) => {
      const res = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, isEnabled }),
      })
      if (!res.ok) throw new Error('Failed to update flag')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'feature-flags'] })
    },
  })
}
