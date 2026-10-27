'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

export function RefreshAllButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { t } = useTranslations()

  async function handleRefreshAll() {
    setLoading(true)
    const toastId = toast.loading(t('characters.refreshAllLoading'))
    
    try {
      const res = await fetch('/api/characters/refresh-all', { method: 'POST' })
      if (!res.ok) throw new Error('Refresh all failed')
      
      const data = await res.json()
      toast.success(t('characters.refreshAllSuccess', { count: data.successCount || 0 }), { id: toastId })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || t('characters.refreshAllError'), { id: toastId })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button 
      variant="outline"
      onClick={handleRefreshAll}
      disabled={loading}
      className="border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white"
    >
      <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
      {loading ? t('characters.refreshAllButtonLoading') : t('characters.refreshAllButton')}
    </Button>
  )
}
