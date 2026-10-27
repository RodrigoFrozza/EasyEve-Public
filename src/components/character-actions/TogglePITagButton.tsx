'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Globe } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { CHARACTER_PI_TAG, CHARACTER_ACTIVITY_TAG_SET } from '@/constants/character-tags'

export function TogglePITagButton({ characterId, tags }: { characterId: number; tags: string[] }) {
  const [loading, setLoading] = useState(false)
  const queryClient = useQueryClient()
  const { t } = useTranslations()

  const hasPITag = tags?.includes(CHARACTER_PI_TAG)

  async function handleTogglePI() {
    setLoading(true)
    const allowedExisting = (tags || []).filter((x) => CHARACTER_ACTIVITY_TAG_SET.has(x))
    const newTags = hasPITag
      ? allowedExisting.filter((x) => x !== CHARACTER_PI_TAG)
      : [...allowedExisting, CHARACTER_PI_TAG]

    try {
      const res = await fetch(`/api/characters/${characterId}/tags`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tags: newTags }),
      })

      if (res.ok) {
        toast.success(t('characters.tagsUpdated'))
        queryClient.setQueryData(['character', characterId], (old: { tags?: string[] } | null | undefined) =>
          old ? { ...old, tags: newTags } : old
        )
        await queryClient.invalidateQueries({ queryKey: ['character', characterId] })
      } else {
        toast.error(t('characters.tagsUpdateFailed'))
      }
    } catch (error) {
      console.error('Toggle PI tag error:', error)
      toast.error(t('characters.tagsUpdateFailed'))
    }
    setLoading(false)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn(
        'transition-all duration-300',
        hasPITag
          ? 'border-cyan-500 bg-cyan-500/20 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
          : 'border-cyan-500/30 text-cyan-400/70 hover:bg-cyan-500/10 hover:border-cyan-500/60'
      )}
      onClick={() => void handleTogglePI()}
      disabled={loading}
    >
      <Globe className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
      {hasPITag ? t('activity.characters.piTagRemove') : t('activity.characters.piTagAdd')}
    </Button>
  )
}
