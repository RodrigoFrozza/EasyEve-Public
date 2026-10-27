import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

/** Row from `ModulePrice` — global feature flags; `price` is a legacy column. */
export interface PlatformModuleRecord {
  id: string
  module: string
  price: number
  isActive: boolean
  updatedAt: string
  createdAt?: string
}

/** @deprecated Use PlatformModuleRecord */
export type ModulePrice = PlatformModuleRecord

export function useAdminPlatformModules() {
  return useQuery<{ modules: PlatformModuleRecord[] }>({
    queryKey: ['admin', 'module-prices'],
    queryFn: async () => {
      const res = await fetch('/api/admin/module-prices')
      if (!res.ok) throw new Error('Failed to fetch platform modules')
      return res.json()
    },
    staleTime: 30 * 1000,
  })
}

/** @deprecated Use useAdminPlatformModules */
export const useAdminModulePrices = useAdminPlatformModules

export function useUpdatePlatformModule() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      module,
      isActive,
      price,
    }: {
      module: string
      isActive: boolean
      /** Omit to keep the existing stored value (legacy column). */
      price?: number
    }) => {
      const res = await fetch('/api/admin/module-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ module, isActive, ...(price !== undefined ? { price } : {}) }),
      })
      if (!res.ok) throw new Error('Failed to update module')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'module-prices'] })
    },
  })
}

/** @deprecated Use useUpdatePlatformModule */
export const useUpdateModulePrice = useUpdatePlatformModule
