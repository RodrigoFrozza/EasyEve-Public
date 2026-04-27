'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Recycle, X, ArrowLeft } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'

interface LootItem {
  name: string
  quantity: number
  value?: number
  typeId?: number
}

interface LootEntryDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: {
    id: string
    type: 'mtu' | 'salvage'
    date: string
    amount: number
    itemsCount: number
    items: LootItem[]
    index: number
  } | null
  onBack?: () => void
}

function LootItemRow({ item, type, index }: { item: LootItem; type: 'mtu' | 'salvage'; index: number }) {
  const isIdentified = item.value && item.value > 0

  return (
    <motion.div 
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-center text-[10px] py-1.5 px-2 rounded hover:bg-zinc-800/30 transition-colors group cursor-default"
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {item.typeId ? (
          <img src={`https://images.evetech.net/types/${item.typeId}/icon`} alt={item.name} className="w-6 h-6 rounded" />
        ) : (
          <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
            {type === 'mtu' ? <Package className="w-3 h-3 text-zinc-500" /> : <Recycle className="w-3 h-3 text-zinc-500" />}
          </div>
        )}
        <span className={cn("truncate", isIdentified ? "text-zinc-300" : "text-rose-400 font-medium")}>{item.name}</span>
      </div>
      
      <div className="w-16 text-right font-mono text-zinc-400">
        {item.quantity.toLocaleString()}
      </div>
      
      <div className="w-24 text-right font-mono hidden sm:block">
        <span className={cn(isIdentified ? "text-emerald-400/70" : "text-rose-400/70")}>
          {isIdentified ? formatISK(item.value || 0) : '---'}
        </span>
      </div>
      
      <div className="w-28 text-right font-mono">
        <span className={cn(isIdentified ? "text-emerald-400" : "text-rose-400")}>
          {isIdentified ? formatISK((item.value || 0) * item.quantity) : '???'}
        </span>
      </div>
    </motion.div>
  )
}

export function LootEntryDetailModal({ open, onOpenChange, entry, onBack }: LootEntryDetailModalProps) {
  const { t } = useTranslations()

  if (!entry) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#0a0a0f] border-zinc-800 shadow-2xl overflow-hidden p-0 max-h-[90vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className={cn(
            "absolute top-0 left-0 w-full h-1 bg-gradient-to-r",
            entry.type === 'mtu' ? "from-blue-500 via-cyan-500 to-indigo-500" : "from-orange-500 via-yellow-500 to-amber-500"
          )} />
          
          <DialogHeader className="p-6 pb-2 relative">
            <div className={cn(
              "absolute inset-0 bg-gradient-to-b opacity-10 pointer-events-none",
              entry.type === 'mtu' ? "from-blue-500 to-transparent" : "from-orange-500 to-transparent"
            )} />
            <div className="flex items-center gap-3 relative">
              {onBack && (
                <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800/50 -ml-2">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                {entry.type === 'mtu' ? (
                  <Package className="h-5 w-5 text-blue-400" />
                ) : (
                  <Recycle className="h-5 w-5 text-orange-400" />
                )}
              </motion.div>
              <DialogTitle className="text-xl font-black text-white">
                {entry.type === 'mtu' ? t('activity.ratting.mtu') : t('activity.ratting.salvage')} #{entry.index}
              </DialogTitle>
            </div>
            <DialogDescription className="text-zinc-500 text-xs mt-1 pl-11">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.1 }}
              >
                <FormattedDate date={entry.date} mode="datetime" />
              </motion.div>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 pt-2">
            <motion.div 
              className="flex items-center justify-between mb-4 px-2 py-3 bg-zinc-900/30 rounded-lg border border-zinc-800/50"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <div className="flex items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    {t('activity.lootList.items')}
                  </span>
                  <span className="text-sm text-zinc-300 font-medium">
                    {entry.items.length} {t('activity.lootList.items').toLowerCase()}
                  </span>
                </div>
                <div className="w-px h-8 bg-zinc-800" />
                <div className="flex flex-col">
                  <span className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">
                    {t('activity.lootList.total')}
                  </span>
                  <motion.span 
                    className={cn(
                      "text-lg font-black font-mono",
                      entry.type === 'mtu' ? "text-blue-400" : "text-orange-400"
                    )}
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30, delay: 0.2 }}
                  >
                    {formatISK(entry.amount)}
                  </motion.span>
                </div>
              </div>
            </motion.div>

            <ScrollArea className="h-[300px] rounded-lg border border-zinc-800 bg-zinc-950/30 p-2">
              <div className="space-y-1">
                <motion.div 
                  className="flex items-center justify-between text-[9px] font-black uppercase text-zinc-500 tracking-wider px-2 py-1 mb-1 border-b border-zinc-800/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <div className="flex-1">Item</div>
                  <div className="w-16 text-right">Qtd</div>
                  <div className="w-24 text-right hidden sm:block">Unit</div>
                  <div className="w-28 text-right">Total</div>
                </motion.div>
                
                <AnimatePresence>
                  {entry.items.map((item, idx) => (
                    <LootItemRow key={idx} item={item} type={entry.type} index={idx} />
                  ))}
                </AnimatePresence>
                
                {entry.items.length === 0 && (
                  <div className="py-8 text-center text-zinc-600 text-xs font-black uppercase tracking-widest">
                    {t('activity.lootList.noEntries')}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

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
  )
}