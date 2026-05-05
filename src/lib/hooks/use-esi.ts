'use client'

import { useQuery, useMutation, useQueryClient, useIsMutating } from '@tanstack/react-query'
import { remoteLogger } from '@/lib/remote-logger'
import { AppError, throwAppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import type { CharacterListItem } from '@/types/character'

/**
 * Custom hook to fetch ESI-related data from the local API endpoints.
 * Integrates with Tanstack Query for caching and loading states.
 */
export function useCharacterData(characterId?: number, initialData?: CharacterListItem) {
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
    initialData,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    enabled: !!characterId,
  })

  const refreshMutation = useMutation({
    mutationKey: ['refresh-character', characterId],
    mutationFn: async () => {
      if (!characterId) return
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30000)
      try {
        const response = await fetch(`/api/characters/${characterId}`, { 
          method: 'POST',
          signal: controller.signal
        })
        if (!response.ok) {
          throwAppError(ErrorCodes.ESI_REFRESH_FAILED, `HTTP ${response.status}: Failed to refresh character data`)
        }
        return response.json()
      } finally {
        clearTimeout(timeoutId)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['character', characterId] })
      queryClient.invalidateQueries({ queryKey: ['characters'] })
    },
    onError: (error) => {
      remoteLogger.error('Failed to refresh character data', error, { characterId })
    }
  })

  const isMutating = useIsMutating({ 
    mutationKey: ['refresh-character', characterId],
    exact: true 
  })

  return {
    ...query,
    refresh: refreshMutation.mutate,
    isRefreshing: (characterId ? isMutating > 0 : false) || refreshMutation.isPending,
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
