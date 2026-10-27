'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-error'
import { useTranslations } from '@/i18n/hooks'

export function RemoveCharacterButton({ characterId }: { characterId: number }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()

  async function handleRemove() {
    if (!confirm(t('characters.removeConfirm'))) return
    
    setLoading(true)
    try {
      const { error } = await apiClient.delete(`/api/characters/${characterId}`, { 
        showToast: true 
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
    <Button 
      variant="outline" 
      size="sm" 
      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
      onClick={handleRemove}
      disabled={loading}
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {t('characters.remove')}
    </Button>
  )
}
