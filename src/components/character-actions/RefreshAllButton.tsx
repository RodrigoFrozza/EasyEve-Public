'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshCw } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export function RefreshAllButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleRefreshAll() {
    setLoading(true)
    const toastId = toast.loading('Synchronizing all characters...')
    
    try {
      const res = await fetch('/api/characters/refresh-all', { method: 'POST' })
      if (!res.ok) throw new Error('Refresh all failed')
      
      const data = await res.json()
      toast.success(`Sync complete! ${data.successCount} characters updated.`, { id: toastId })
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh all', { id: toastId })
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
      {loading ? 'Syncing Fleet...' : 'Refresh All'}
    </Button>
  )
}
