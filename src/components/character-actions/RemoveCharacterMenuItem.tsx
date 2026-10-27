'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { apiClient } from '@/lib/api-error'
import { useTranslations } from '@/i18n/hooks'

export function RemoveCharacterMenuItem({ characterId }: { characterId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()

  async function handleRemove() {
    if (!confirm(t('characters.removeConfirm'))) return

    setLoading(true)
    try {
      const { error } = await apiClient.delete(`/api/characters/${characterId}`, {
        showToast: true,
      })

      if (!error) {
        router.refresh()
      }
    } catch (error) {
      console.error('Remove error:', error)
    }
    setLoading(false)
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer text-red-400 focus:text-red-400"
      disabled={loading}
      onSelect={(e) => {
        e.preventDefault()
        void handleRemove()
      }}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {t('characters.removeCharacter')}
    </DropdownMenuItem>
  )
}
