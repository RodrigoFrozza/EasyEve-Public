'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { remoteLogger } from '@/lib/remote-logger'
import { AppError, throwAppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

/**
 * Custom hook to fetch ESI-related data from the local API endpoints.
 * Integrates with Tanstack Query for caching and loading states.
 */
export function useCharacterData(characterId?: number) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['character', characterId],
    queryFn: async () => {
      if (!characterId) return null
      const response = await fetch(`/api/characters/${characterId}`)
      if (!response.ok) {
        throwAppError(ErrorCodes.ESI_FETCH_FAILED, `HTTP ${response.status}: Failed to fetch character data`)
      }
      return response.json()
    },
    enabled: !!characterId,
  })

  const refreshMutation = useMutation({
    mutationFn: async () => {
      if (!characterId) return
      const response = await fetch(`/api/characters/${characterId}`, { method: 'POST' })
      if (!response.ok) {
        throwAppError(ErrorCodes.ESI_REFRESH_FAILED, `HTTP ${response.status}: Failed to refresh character data`)
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId] })
    },
    onError: (error) => {
      remoteLogger.error('Failed to refresh character data', error, { characterId })
    }
  })

  return {
    ...query,
    refresh: refreshMutation.mutate,
    isRefreshing: refreshMutation.isPending,
  }
}

/**
 * Hook for fetching character assets
 */
export function useCharacterAssets(characterId?: number) {
  return useQuery({
    queryKey: ['assets', characterId],
    queryFn: async () => {
      if (!characterId) return []
      const response = await fetch(`/api/characters/${characterId}/assets`)
      if (!response.ok) {
        throwAppError(ErrorCodes.ESI_FETCH_FAILED, `HTTP ${response.status}: Failed to fetch assets`)
      }
      return response.json()
    },
    enabled: !!characterId,
  })
}

/**
 * Hook for fetching character fits
 */
export function useCharacterFits(characterId?: number) {
  return useQuery({
    queryKey: ['fits', characterId],
    queryFn: async () => {
      if (!characterId) return []
      const response = await fetch(`/api/characters/${characterId}/fits`)
      if (!response.ok) {
        throwAppError(ErrorCodes.ESI_FETCH_FAILED, `HTTP ${response.status}: Failed to fetch fits`)
      }
      return response.json()
    },
    enabled: !!characterId,
  })
}
