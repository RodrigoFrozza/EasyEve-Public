'use client'

import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

export function useSocialMutations() {
  const queryClient = useQueryClient()
  const { t } = useTranslations()
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())

  const withPending = useCallback(
    async (id: string, fn: () => Promise<void>) => {
      setPendingIds((prev) => new Set(prev).add(id))
      try {
        await fn()
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      }
    },
    []
  )

  const isPending = useCallback((id: string) => pendingIds.has(id), [pendingIds])

  const handleRequest = useCallback(
    async (requestId: string, action: 'accept' | 'reject') => {
      await withPending(`${requestId}-${action}`, async () => {
        try {
          await axios.post(`/api/players/contacts/${requestId}`, { action })
          queryClient.invalidateQueries({ queryKey: ['contacts'] })
          toast.success(
            action === 'accept' ? t('social.acceptSuccess') : t('social.rejectSuccess')
          )
        } catch {
          toast.error(t('common.error'))
          throw new Error('request failed')
        }
      })
    },
    [queryClient, t, withPending]
  )

  const cancelRequest = useCallback(
    async (requestId: string) => {
      await withPending(requestId, async () => {
        try {
          await axios.delete(`/api/players/contacts/${requestId}`)
          queryClient.invalidateQueries({ queryKey: ['contacts'] })
          toast.success(t('social.cancelSuccess'))
        } catch {
          toast.error(t('common.error'))
          throw new Error('cancel failed')
        }
      })
    },
    [queryClient, t, withPending]
  )

  const removeContact = useCallback(
    async (contactId: string) => {
      await withPending(contactId, async () => {
        try {
          await axios.delete(`/api/players/contacts/remove/${contactId}`)
          queryClient.invalidateQueries({ queryKey: ['contacts'] })
          toast.success(t('social.removeSuccess'))
        } catch {
          toast.error(t('common.error'))
          throw new Error('remove failed')
        }
      })
    },
    [queryClient, t, withPending]
  )

  const sendRequest = useCallback(
    async (userId: string) => {
      await withPending(userId, async () => {
        try {
          await axios.post('/api/players/contacts', { targetUserId: userId })
          queryClient.invalidateQueries({ queryKey: ['contacts'] })
          toast.success(t('social.sendSuccess'))
        } catch {
          toast.error(t('common.error'))
          throw new Error('send failed')
        }
      })
    },
    [queryClient, t, withPending]
  )

  return {
    handleRequest,
    cancelRequest,
    removeContact,
    sendRequest,
    isPending,
  }
}
