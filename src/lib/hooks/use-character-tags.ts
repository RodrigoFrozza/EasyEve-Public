'use client'

import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'

export function useCharacterTags(characterId: number, currentTags: string[]) {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const [tagSaving, setTagSaving] = useState(false)

  const updateTags = useCallback(
    async (newTags: string[]) => {
      if (tagSaving) return
      setTagSaving(true)
      try {
        const res = await fetch(`/api/characters/${characterId}/tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newTags }),
        })
        if (!res.ok) {
          toast.error(t('characters.tagsUpdateFailed'))
          return
        }
        toast.success(t('characters.tagsUpdated'))
        queryClient.setQueryData(['character', characterId], (old: unknown) =>
          old && typeof old === 'object' ? { ...old, tags: newTags } : old
        )
        await queryClient.invalidateQueries({ queryKey: ['characters'] })
        await queryClient.invalidateQueries({ queryKey: ['characters', 'tags'] })
      } catch (error) {
        console.error('Update tags error:', error)
        toast.error(t('characters.tagsUpdateFailed'))
        throw error
      } finally {
        setTagSaving(false)
      }
    },
    [characterId, queryClient, t, tagSaving]
  )

  const toggleTag = useCallback(
    async (tag: string) => {
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((x) => x !== tag)
        : [...currentTags, tag]
      await updateTags(newTags)
    },
    [currentTags, updateTags]
  )

  return { tagSaving, updateTags, toggleTag }
}
