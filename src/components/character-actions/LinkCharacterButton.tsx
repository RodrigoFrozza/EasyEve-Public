'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from '@/i18n/hooks'

export function LinkCharacterButton({ accountCode }: { accountCode?: string | null }) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  
  function handleLink() {
    setLoading(true)
    if (accountCode) {
      router.push(`/link-character?accountCode=${accountCode}`)
    } else {
      router.push('/link-character')
    }
  }
  
  return (
    <Button 
      onClick={handleLink} 
      disabled={loading}
      className="bg-eve-accent text-black hover:bg-eve-accent/80"
    >
      <Plus className="mr-2 h-4 w-4" />
      {loading ? t('global.redirectingToEve') : t('characters.linkCharacter')}
    </Button>
  )
}
