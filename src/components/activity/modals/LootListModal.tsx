'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Recycle, Plus, X, Trash2, Loader2, TrendingUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { MTUInputModal, SalvageInputModal } from './'
import { LootEntryDetailModal } from './LootEntryDetailModal'

interface LootItem {
  name: string
  quantity: number
  value?: number
  typeId?: number
}

interface LootEntry {
  id: string
  type: 'mtu' | 'salvage'
  date: string
  amount: number
  itemsCount: number
  entryIndex: number
  items: LootItem[]
  index: number
}

interface LootListModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: any
  onRefresh: () => void
}

function LootEntrySkeleton() {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded bg-zinc-900/30">
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-8" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-12" />
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-3 w-3" />
      </div>
    </div>
  )
}

export function LootListModal({ open, onOpenChange, activity, onRefresh }: LootListModalProps) {
  const { t } = useTranslations()
  const [mtuModalOpen, setMtuModalOpen] = useState(false)
  const [salvageModalOpen, setSalvageModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<LootEntry | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logs = useMemo(() => activity.data?.logs || [], [activity.data])
  const mtuContents = useMemo(() => activity.data?.mtuContents || [], [activity.data])
  const salvageContents = useMemo(() => activity.data?.salvageContents || [], [activity.data])

  useEffect(() => {
    if (open) {
      setIsLoading(true)
      const timer = setTimeout(() => setIsLoading(false), 500)
      return () => clearTimeout(timer)
    } else {
      setIsLoading(true)
    }
  }, [open])

  const mtuEntries: LootEntry[] = useMemo(() => {
    return logs
      .filter((l: any) => l.type === 'mtu')
      .map((log: any, idx: number, arr: any[]) => {
        const realIndex = logs.findIndex((l: any) => l.refId === log.refId)
        return {
          id: log.refId,
          type: 'mtu' as const,
          date: log.date,
          amount: log.amount || 0,
          itemsCount: mtuContents[realIndex]?.length || 0,
          entryIndex: realIndex,
          items: mtuContents[realIndex] || [],
          index: arr.length - idx
        }
      })
      .reverse()
  }, [logs, mtuContents])

  const salvageEntries: LootEntry[] = useMemo(() => {
    return logs
      .filter((l: any) => l.type === 'salvage')
      .map((log: any, idx: number, arr: any[]) => {
        const realIndex = logs.findIndex((l: any) => l.refId === log.refId)
        return {
          id: log.refId,
          type: 'salvage' as const,
          date: log.date,
          amount: log.amount || 0,
          itemsCount: salvageContents[realIndex]?.length || 0,
          entryIndex: realIndex,
          items: salvageContents[realIndex] || [],
          index: arr.length - idx
        }
      })
      .reverse()
  }, [logs, salvageContents])

  const totalMTUValue = useMemo(() => mtuEntries.reduce((sum, e) => sum + e.amount, 0), [mtuEntries])
  const totalSalvageValue = useMemo(() => salvageEntries.reduce((sum, e) => sum + e.amount, 0), [salvageEntries])
  const totalValue = totalMTUValue + totalSalvageValue

  const confirmDelete = (entry: LootEntry) => {
    const promise = new Promise<boolean>((resolve) => {
      toast.promise(
        new Promise<boolean>((res) => {
          const toastId = toast(`${t('activity.lootList.deleteConfirm')}`, {
            action: {
              label: t('common.delete'),
              onClick: () => res(true)
            },
            cancel: {
              label: t('common.cancel'),
              onClick: () => res(false)
            },
            duration: 5000,
          })
        }),
        {
          loading: t('common.loading'),
          success: (confirmed: boolean) => {
            if (confirmed) {
              handleDeleteEntry(entry)
              return t('common.deleted')
            }
            return t('common.cancelled')
          },
          error: t('common.error'),
        }
      )
    })
  }

  const handleDeleteEntry = async (entry: LootEntry) => {
    if (isDeleting) return
    setIsDeleting(entry.id)

    try {
      const logIndex = logs.findIndex((l: any) => l.refId === entry.id)
      if (logIndex === -1) {
        toast.error('Entry not found')
        return
      }

      const newLogs = [...logs]
      newLogs.splice(logIndex, 1)

      const newMtuContents = [...mtuContents]
      const newSalvageContents = [...salvageContents]

      if (entry.type === 'mtu') {
        newMtuContents.splice(logIndex, 1)
      } else {
        newSalvageContents.splice(logIndex, 1)
      }

      const newEstimatedLootValue = newLogs
        .filter((l: any) => l.type === 'mtu')
        .reduce((sum: number, l: any) => sum + (l.amount || 0), 0)

      const newEstimatedSalvageValue = newLogs
        .filter((l: any) => l.type === 'salvage')
        .reduce((sum: number, l: any) => sum + (l.amount || 0), 0)

      const updatedData = {
        ...activity.data,
        logs: newLogs,
        mtuContents: newMtuContents,
        salvageContents: newSalvageContents,
        estimatedLootValue: newEstimatedLootValue,
        estimatedSalvageValue: newEstimatedSalvageValue
      }

      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData })
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast.success(`${entry.type === 'mtu' ? 'MTU' : 'Salvage'} ${t('common.deleted').toLowerCase()}`)
      onRefresh()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error(t('common.error'))
    } finally {
      setIsDeleting(null)
    }
  }

  const handleMtuSaved = () => {
    setMtuModalOpen(false)
    onRefresh()
  }

  const handleSalvageSaved = () => {
    setSalvageModalOpen(false)
    onRefresh()
  }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedEntry && (e.key === 'Enter' || e.key === ' ')) {
      const focusedElement = document.activeElement
      if (focusedElement?.getAttribute('data-loot-entry') === 'true') {
        const entryId = focusedElement.getAttribute('data-entry-id')
        const entry = [...mtuEntries, ...salvageEntries].find(e => e.id === entryId)
        if (entry) setSelectedEntry(entry)
      }
    }
  }, [mtuEntries, salvageEntries, selectedEntry])

  useEffect(() => {
    if (open) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, handleKeyDown])

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: 20, transition: { duration: 0.2 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, x: -10 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.2 } }
  }

  return (
    <>
      <Dialog open={open && !selectedEntry} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl bg-[#0a0a0f] border-zinc-800 shadow-2xl overflow-hidden p-0 max-h-[90vh]">
          <motion.div 
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500" />
            
            <DialogHeader className="p-6 pb-2 relative">
              <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
              <DialogTitle className="text-xl font-black text-white flex items-center gap-2 relative">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  <Package className="h-5 w-5 text-blue-400" />
                </motion.div>
                {t('activity.lootList.title')}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 text-xs mt-1">
                {t('activity.lootList.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 pt-2">
              <motion.div 
                className="flex gap-3 mb-6"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Button 
                  onClick={() => setMtuModalOpen(true)}
                  className="flex-1 bg-blue-600/80 hover:bg-blue-600 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('activity.lootList.addMTU')}
                </Button>
                <Button 
                  onClick={() => setSalvageModalOpen(true)}
                  className="flex-1 bg-orange-600/80 hover:bg-orange-600 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-[1.02] hover:shadow-[0_0_20px_rgba(234,88,12,0.3)] active:scale-[0.98]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('activity.lootList.addSalvage')}
                </Button>
              </motion.div>

              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <div className="space-y-1">
                          {[1, 2, 3].map(i => (
                            <LootEntrySkeleton key={i} />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ) : mtuEntries.length > 0 || salvageEntries.length > 0 ? (
                    <motion.div
                      key="content"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {mtuEntries.length > 0 && (
                        <motion.div 
                          className="space-y-2"
                          initial="hidden"
                          animate="visible"
                          variants={containerVariants}
                        >
                          <div className="flex items-center gap-2 text-[10px] text-blue-400 font-black uppercase tracking-wider">
                            <Package className="h-3 w-3" />
                            {t('activity.lootList.mtuHistory')} ({mtuEntries.length})
                          </div>
                          <ScrollArea className="h-[140px] rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-2">
                            <div className="space-y-1">
                              <AnimatePresence>
                                {mtuEntries.map((entry, idx) => (
                                  <motion.div 
                                    key={entry.id}
                                    data-loot-entry="true"
                                    data-entry-id={entry.id}
                                    variants={itemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => setSelectedEntry(entry)}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedEntry(entry)}
                                    tabIndex={0}
                                    role="button"
                                    className="flex items-center justify-between text-[10px] py-2 px-3 rounded bg-zinc-900/30 hover:bg-zinc-800/50 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-[0_0_10px_rgba(59,130,246,0.1)] focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-zinc-600 font-mono">#{entry.index}</span>
                                      <span className="text-zinc-500">
                                        <FormattedDate date={entry.date} mode="time" />
                                      </span>
                                      <span className="text-zinc-400">
                                        {entry.itemsCount} {t('activity.lootList.items')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-blue-400 font-mono font-bold">
                                        {formatISK(entry.amount)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); confirmDelete(entry); }}
                                        disabled={isDeleting === entry.id}
                                        className="text-zinc-600 hover:text-red-400 transition-all disabled:opacity-50 hover:scale-110"
                                        aria-label="Delete entry"
                                      >
                                        {isDeleting === entry.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}

                      {salvageEntries.length > 0 && (
                        <motion.div 
                          className="space-y-2"
                          initial="hidden"
                          animate="visible"
                          variants={containerVariants}
                        >
                          <div className="flex items-center gap-2 text-[10px] text-orange-400 font-black uppercase tracking-wider">
                            <Recycle className="h-3 w-3" />
                            {t('activity.lootList.salvageHistory')} ({salvageEntries.length})
                          </div>
                          <ScrollArea className="h-[140px] rounded-lg border border-zinc-800/50 bg-zinc-950/30 p-2">
                            <div className="space-y-1">
                              <AnimatePresence>
                                {salvageEntries.map((entry, idx) => (
                                  <motion.div 
                                    key={entry.id}
                                    data-loot-entry="true"
                                    data-entry-id={entry.id}
                                    variants={itemVariants}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    transition={{ delay: idx * 0.05 }}
                                    onClick={() => setSelectedEntry(entry)}
                                    onKeyDown={(e) => e.key === 'Enter' && setSelectedEntry(entry)}
                                    tabIndex={0}
                                    role="button"
                                    className="flex items-center justify-between text-[10px] py-2 px-3 rounded bg-zinc-900/30 hover:bg-zinc-800/50 cursor-pointer transition-all hover:scale-[1.01] hover:shadow-[0_0_10px_rgba(234,88,12,0.1)] focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                                  >
                                    <div className="flex items-center gap-3">
                                      <span className="text-zinc-600 font-mono">#{entry.index}</span>
                                      <span className="text-zinc-500">
                                        <FormattedDate date={entry.date} mode="time" />
                                      </span>
                                      <span className="text-zinc-400">
                                        {entry.itemsCount} {t('activity.lootList.items')}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                      <span className="text-orange-400 font-mono font-bold">
                                        {formatISK(entry.amount)}
                                      </span>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); confirmDelete(entry); }}
                                        disabled={isDeleting === entry.id}
                                        className="text-zinc-600 hover:text-red-400 transition-all disabled:opacity-50 hover:scale-110"
                                        aria-label="Delete entry"
                                      >
                                        {isDeleting === entry.id ? (
                                          <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                          <Trash2 className="h-3 w-3" />
                                        )}
                                      </button>
                                    </div>
                                  </motion.div>
                                ))}
                              </AnimatePresence>
                            </div>
                          </ScrollArea>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="py-12 text-center"
                    >
                      <motion.div
                        initial={{ y: 10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                      >
                        <div className="relative inline-block">
                          <Package className="h-12 w-12 text-zinc-800 mx-auto mb-3" />
                          <div className="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent blur-xl rounded-full" />
                        </div>
                        <p className="text-xs text-zinc-600 font-black uppercase tracking-widest">
                          {t('activity.lootList.noEntries')}
                        </p>
                        <p className="text-[10px] text-zinc-700 mt-2">
                          {t('activity.lootList.addMTU')} / {t('activity.lootList.addSalvage')}
                        </p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <motion.div 
              className="p-6 pt-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-2 text-zinc-500">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    {t('activity.lootList.total')}
                  </span>
                </div>
                <motion.span 
                  className="text-xl font-black text-white font-mono"
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {formatISK(totalValue)}
                </motion.span>
              </div>
            </motion.div>

            <DialogFooter className="p-6 bg-zinc-950/50 border-t border-white/[0.03] gap-3">
              <Button 
                variant="ghost" 
                onClick={() => onOpenChange(false)}
                className="text-zinc-500 hover:text-white"
              >
                <X className="h-4 w-4 mr-2" />
                {t('common.close')}
              </Button>
            </DialogFooter>
          </motion.div>
        </DialogContent>
      </Dialog>

      <MTUInputModal
        open={mtuModalOpen}
        onOpenChange={setMtuModalOpen}
        onSave={handleMtuSaved}
        existingItems={[]}
      />
      
      <SalvageInputModal
        open={salvageModalOpen}
        onOpenChange={setSalvageModalOpen}
        onSave={handleSalvageSaved}
        existingItems={[]}
      />

      <LootEntryDetailModal
        open={!!selectedEntry}
        onOpenChange={(open) => !open && setSelectedEntry(null)}
        entry={selectedEntry}
        onBack={() => setSelectedEntry(null)}
      />
    </>
  )
}