import { useQuery } from '@tanstack/react-query'
import { getCorporationInfo } from '@/lib/esi'

export interface CorporationInfo {
  name: string
  ticker?: string
}

export function useCorporationInfo(corporationId: number | null | undefined) {
  return useQuery({
    queryKey: ['corporation', corporationId],
    queryFn: () => getCorporationInfo(corporationId!),
    enabled: !!corporationId,
    staleTime: 15 * 60 * 1000, // 15 minutes
    retry: 1,
  })
}
