'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { Recycle, Save, X, Plus, Loader2, TrendingUp, Circle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { formatISK, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { parseEVECargo } from '@/lib/parsers/eve-cargo-parser'
import { getMarketAppraisalWithIds } from '@/lib/market'

interface SalvageItem {
  name: string
  quantity: number
  value?: number
  typeId?: number
}

interface SalvageInputModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (items: SalvageItem[]) => void
  existingItems?: SalvageItem[]
}

export function SalvageInputModal({ open, onOpenChange, onSave, existingItems = [] }: SalvageInputModalProps) {
  const { t } = useTranslations()
  const [items, setItems] = useState<SalvageItem[]>([])
  const [rawInput, setRawInput] = useState('')
  const [isValuating, setIsValuating] = useState(false)
  const [hasAutoParsed, setHasAutoParsed] = useState(false)
  const lastRawInputRef = useRef('')

  const totalValue = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.value || 0) * item.quantity, 0)
  }, [items])

  const fetchPrices = async (itemsToValuate: SalvageItem[]) => {
    if (itemsToValuate.length === 0) return
    
    setIsValuating(true)
    try {
      const itemNames = itemsToValuate.map(i => i.name)
      const pricesData = await getMarketAppraisalWithIds(itemNames)
      
      setItems(prev => prev.map(item => {
        const data = pricesData[item.name.toLowerCase()]
        return {
          ...item,
          value: data?.price || 0,
          typeId: data?.id
        }
      }))
    } catch (e) {
      console.error('Failed to fetch prices:', e)
    } finally {
      setIsValuating(false)
    }
  }

  useEffect(() => {
    if (open) {
      setHasAutoParsed(false)
      lastRawInputRef.current = ''
      setItems([])
    }
  }, [open])

  useEffect(() => {
    if (!open) {
      setItems([])
      setRawInput('')
      setHasAutoParsed(false)
    }
  }, [open])

  const handleParseRawInput = () => {
    if (!rawInput.trim()) {
      toast.error('Please paste salvage content')
      return
    }

    const parsedMap = parseEVECargo(rawInput)
    const parsed: SalvageItem[] = Array.from(parsedMap.entries()).map(([name, quantity]) => ({
      name,
      quantity,
      value: 0
    }))

    if (parsed.length === 0) {
      toast.error('Could not parse salvage content. Ensure it is in EVE clipboard format.')
      return
    }

    setItems(parsed)
    toast.success(`Parsed ${parsed.length} items`)
    fetchPrices(parsed)
  }

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const handleQuantityChange = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = { ...newItems[index], quantity: parseInt(value) || 0 }
    setItems(newItems)
  }

  const handleSave = () => {
    if (items.length === 0) {
      toast.error('Add at least one item')
      return
    }
    onSave(items)
    onOpenChange(false)
    setRawInput('')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl bg-[#0a0a0f] border-zinc-800 shadow-2xl overflow-hidden p-0 max-h-[90vh] overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-orange-500 via-yellow-500 to-amber-500" />
          
          <DialogHeader className="p-6 pb-0 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-500/5 to-transparent pointer-events-none" />
            <DialogTitle className="text-xl font-black text-white flex items-center gap-2 relative">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <Recycle className="h-5 w-5 text-orange-400" />
              </motion.div>
              {t('activity.salvage.title')}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 text-xs mt-1">
              {t('activity.salvage.pasteInstructions')}
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase text-orange-500 tracking-widest flex items-center gap-2">
                  <Plus className="h-3 w-3" /> {t('activity.salvage.pasteLoot')}
                </Label>
                <Textarea 
                  placeholder="1 x Damaged Armor&#10;5 x Scrapped Metal&#10;10 x Broken Drone"
                  className="min-h-[200px] bg-zinc-900/50 border border-orange-500/30 text-xs font-mono resize-none focus:border-orange-500 focus:shadow-[0_0_15px_rgba(255,191,0,0.15)] transition-all"
                  value={rawInput}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setRawInput(newValue)
                    if (!hasAutoParsed && newValue.trim() && newValue.length > lastRawInputRef.current.length + 10) {
                      lastRawInputRef.current = newValue
                      setHasAutoParsed(true)
                      setTimeout(() => handleParseRawInput(), 100)
                    }
                  }}
                />
                <Button 
                  onClick={handleParseRawInput}
                  disabled={!rawInput.trim() || isValuating}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  {isValuating ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {isValuating ? t('activity.salvage.pricing') : t('activity.salvage.parseItems')}
                </Button>
              </div>

              <AnimatePresence>
                {items.length > 0 && (
                  <motion.div 
                    className="space-y-2"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-orange-500 tracking-wider flex items-center gap-2">
                        <Circle className="h-2 w-2 fill-orange-500" /> {t('activity.salvage.items')} ({items.length})
                      </Label>
                      {isValuating ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 animate-spin text-orange-400" />
                          <span className="text-[9px] text-zinc-500">{t('activity.salvage.pricing')}</span>
                        </div>
                      ) : (
                        <span className="text-[9px] text-orange-400 font-bold">
                          {formatISK(totalValue)}
                        </span>
                      )}
                    </div>
                    <ScrollArea className="h-[180px] rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
                      <div className="space-y-1">
                        <AnimatePresence>
                          {items.map((item, idx) => (
                            <motion.div 
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 10 }}
                              transition={{ delay: idx * 0.03 }}
                              className="flex items-center justify-between text-[10px] py-1.5 px-2 rounded hover:bg-zinc-800/50 group transition-all hover:scale-[1.01]"
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {item.typeId ? (
                                  <img src={`https://images.evetech.net/types/${item.typeId}/icon`} alt={item.name} className="w-6 h-6 rounded" />
                                ) : (
                                  <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center">
                                    <Recycle className="w-3 h-3 text-zinc-500" />
                                  </div>
                                )}
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(idx, e.target.value)}
                                  className="w-14 h-6 bg-zinc-900 border border-zinc-800 rounded text-center font-mono text-[10px] text-zinc-300 focus:border-orange-500 focus:outline-none"
                                />
                                <span className={cn("truncate", item.value && item.value > 0 ? "text-emerald-400" : "text-rose-400 font-medium")}>{item.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={cn("font-mono text-[9px]", item.value && item.value > 0 ? "text-emerald-400" : "text-rose-400")}>
                                  {item.value ? formatISK((item.value || 0) * item.quantity) : '???'}
                                </span>
                                <button
                                  onClick={() => handleRemoveItem(idx)}
                                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-all hover:scale-110"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </ScrollArea>
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.div 
                className="p-3 bg-zinc-900/40 rounded-xl border border-white/[0.03] space-y-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                <div className="flex items-center gap-2 text-zinc-400">
                  <Info className="h-3 w-3" />
                  <span className="text-[10px] font-medium">{t('activity.salvage.inGameInstructions')}</span>
                </div>
              </motion.div>
            </div>

            <motion.div 
              className="bg-zinc-950/30 rounded-xl p-4 border border-white/[0.02]"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <div className="text-center py-8">
                <motion.div
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  <Recycle className="h-12 w-12 text-zinc-700 mx-auto mb-3" />
                </motion.div>
                <p className="text-xs text-zinc-500 font-medium">{t('activity.salvage.currentValue')}</p>
                <motion.p 
                  className="text-2xl font-black text-orange-400 font-mono mt-1"
                  key={totalValue}
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {isValuating ? '...' : formatISK(totalValue)}
                </motion.p>
                {items.length > 0 && (
                  <motion.div 
                    className="mt-4 pt-4 border-t border-zinc-800"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">
                      {items.length} {t('activity.salvage.uniqueItems')}
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </div>

          <DialogFooter className="p-6 bg-zinc-950/50 border-t border-white/[0.03] gap-3">
            <Button 
              variant="ghost" 
              onClick={() => onOpenChange(false)}
              className="text-zinc-500 hover:text-white"
            >
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button 
              onClick={handleSave}
              disabled={items.length === 0 || isValuating}
              className="px-8 bg-orange-600 hover:bg-orange-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,191,0,0.2)]"
            >
              <Save className="h-4 w-4 mr-2" />
              {t('activity.salvage.save')} {items.length > 0 ? `(${items.length})` : ''}
            </Button>
          </DialogFooter>
        </motion.div>
      </DialogContent>
    </Dialog>
  )
}