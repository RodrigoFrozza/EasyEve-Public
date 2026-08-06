import { useQuery, UseQueryOptions } from '@tanstack/react-query'
import { verifyJWT } from '@/lib/auth-jwt'

export function useAdminQuery<T>(
  key: string[],
  fetcher: () => Promise<T>,
  options?: Omit<UseQueryOptions<T>, 'queryKey' | 'queryFn'>
) {
  return useQuery<T>({
    queryKey: ['admin', ...key],
    queryFn: fetcher,
    refetchInterval: false,
    staleTime: 60 * 1000,
    ...options,
  })
}
