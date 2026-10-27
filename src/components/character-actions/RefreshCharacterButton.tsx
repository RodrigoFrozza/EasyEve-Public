'use client'

import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useCharacterData } from '@/lib/hooks/use-esi'
import { useTranslations } from '@/i18n/hooks'

export function RefreshCharacterButton({ characterId }: { characterId: number }) {
  const { refresh, isRefreshing } = useCharacterData(characterId)
  const { t } = useTranslations()

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="flex-1 border-eve-border"
      onClick={() => refresh()}
      disabled={isRefreshing}
      aria-label={t('characters.refresh')}
      title={t('characters.refresh')}
    >
      <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      Refresh
    </Button>
  )
}
