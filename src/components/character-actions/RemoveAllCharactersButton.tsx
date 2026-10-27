'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2, AlertTriangle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'

export function RemoveAllCharactersButton() {
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const router = useRouter()
  const { t } = useTranslations()

  async function handleRemoveAll() {
    setLoading(true)
    try {
      const res = await fetch('/api/characters/remove-all', { method: 'POST' })
      if (!res.ok) throw new Error('Bulk remove failed')
      
      toast.success(t('common.success'), { description: 'All characters successfully removed.' })
      setOpen(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove all characters')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline"
          size="sm"
          className="border-red-500/30 text-red-500/70 hover:bg-red-500/10 hover:text-red-500 transition-all"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          {t('common.deleteAll') || 'Remove All'}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-[#0a0a0f] border-red-500/20 text-white max-w-md shadow-[0_0_50px_rgba(239,68,68,0.1)]">
        <DialogHeader>
          <DialogTitle className="text-red-500 flex items-center gap-2 text-xl font-black">
            <AlertTriangle className="h-6 w-6" />
            CRITICAL ACTION
          </DialogTitle>
          <DialogDescription className="text-zinc-400 font-medium pt-2">
            This will permanently remove <strong>EVERY</strong> character currently linked to this account. 
            All cached data, wallet history, and fleet configurations associated with these characters will be lost.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="bg-red-500/5 border border-red-500/20 p-4 rounded-xl">
            <p className="text-xs text-red-400 font-bold uppercase tracking-tight mb-2">{t('global.confirmDeleteType')}</p>
            <input 
              type="text" 
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="Type DELETE"
              className="w-full bg-black border border-red-500/30 rounded-lg px-3 py-2 text-white font-mono text-center tracking-[0.3em] focus:outline-none focus:border-red-500 transition-all"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-3 sm:gap-0 mt-2">
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            className="flex-1 text-zinc-500 hover:text-white hover:bg-white/5"
          >
            {t('common.cancel')}
          </Button>
          <Button
            variant="destructive"
            onClick={handleRemoveAll}
            disabled={loading || confirmText !== 'DELETE'}
            className="flex-1 bg-red-600 hover:bg-red-700 font-black"
          >
            {loading ? 'Processing...' : 'CONFIRM PURGE'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
