'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { timeAgo } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import {
  CHARACTER_STALE_THRESHOLD_MS,
  CHARACTER_TOKEN_EXPIRY_SOON_THRESHOLD_MS,
} from '@/lib/characters/constants'

export function AutoRefreshManager({ 
  characters 
}: { 
  characters: { 
    id: number; 
    name: string; 
    lastFetchedAt: Date | null;
    tokenExpiresAt?: Date | null;
  }[] 
}) {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  
  useEffect(() => {
    if (!characters || characters.length === 0) return

    const now = Date.now()
    
    // 1. Check for stale data (Existing logic, but improved)
    const staleChar = [...characters].sort((a, b) => {
      const timeA = a.lastFetchedAt ? new Date(a.lastFetchedAt).getTime() : 0
      const timeB = b.lastFetchedAt ? new Date(b.lastFetchedAt).getTime() : 0
      return timeA - timeB
    })[0]

    const lastSync = staleChar.lastFetchedAt ? new Date(staleChar.lastFetchedAt).getTime() : 0
    const needsDataSync = now - lastSync > CHARACTER_STALE_THRESHOLD_MS

    // 2. Check for expired tokens (New logic)
    // Refresh tokens if they are already expired or expiring within 5 minutes
    const expiredTokenChar = characters.find(c => {
      if (!c.tokenExpiresAt) return false
      const expiresAt = new Date(c.tokenExpiresAt).getTime()
      return expiresAt < now + CHARACTER_TOKEN_EXPIRY_SOON_THRESHOLD_MS
    })

    if (needsDataSync || expiredTokenChar) {
      const reason = needsDataSync 
        ? `Stale data (>6h) for ${staleChar.name}` 
        : `Token expiring for ${expiredTokenChar?.name}`
      
      console.log(`[AutoRefresh] Triggering sync. Reason: ${reason}`)
      
      // If it's just a token refresh, we do it silently unless it's a major data sync
      if (needsDataSync) {
        toast.info(t('characters.autoRefreshToastTitle'), {
          description: t('characters.autoRefreshToastDescription', { time: timeAgo(new Date(lastSync)) })
        })
      }
      
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60s timeout for bulk refresh

      fetch('/api/characters/refresh-all', { method: 'POST', signal: controller.signal })
        .then(res => {
          if (res.ok) {
            console.log('[AutoRefresh] Sync successful, updating UI...')
            // Invalidate all character queries to ensure client hooks get fresh data
            queryClient.invalidateQueries({ queryKey: ['character'] })
            queryClient.invalidateQueries({ queryKey: ['characters'] })
          }
        })
        .catch(err => console.error('[AutoRefresh] Sync failed:', err))
        .finally(() => clearTimeout(timeoutId))
    }
  }, [characters, queryClient, t])

  return null
}
