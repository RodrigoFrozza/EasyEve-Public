'use client'

import { useState, useEffect, useMemo } from 'react'
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, 
  DialogFooter, DialogDescription 
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslations } from '@/i18n/hooks'
import { 
  History, Plus, Loader2, Sparkles, 
  ClipboardCopy, Info, TrendingUp, Circle, Search, Pencil
} from 'lucide-react'
import { EXPLORATION_SITE_TYPES } from '@/lib/constants/activity-data'
import { calculateLootDelta } from '@/lib/parsers/eve-cargo-parser'
import { useActivityStore } from '@/lib/stores/activity-store'
import { toast } from 'sonner'
import { formatISK, cn } from '@/lib/utils'

interface LootItem {
  name: string
  quantity: number
  price: number
  totalValue: number
}

interface AddExplorationLootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: any
}

export function AddExplorationLootModal({ 
  open, 
  onOpenChange, 
  activity 
}: AddExplorationLootModalProps) {
  const { t } = useTranslations()
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')
  const spaceType = activity?.space || activity?.data?.currentSpaceType || 'Highsec'
  const [siteName, setSiteName] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [showSiteSuggestions, setShowSiteSuggestions] = useState(false)
  const [beforeEditable, setBeforeEditable] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [deltaItems, setDeltaItems] = useState<LootItem[]>([])
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [lastUsedSiteName, setLastUsedSiteName] = useState('')
  
  const { updateActivity } = useActivityStore()

  const filteredSites = useMemo(() => {
    if (!searchTerm.trim()) return EXPLORATION_SITE_TYPES.slice(0, 15)
    const term = searchTerm.toLowerCase()
    return EXPLORATION_SITE_TYPES
      .filter(site => site.toLowerCase().includes(term))
      .slice(0, 12)
      .sort()
  }, [searchTerm])

  useEffect(() => {
    if (open) {
      setAfterText('')
      setDeltaItems([])
      setBeforeText(activity?.data?.lastCargoState || '')
    }
  }, [open])

  useEffect(() => {
    if (!afterText) {
      setDeltaItems([])
      return
    }

    const calculateAndFetchPrices = async () => {
      const loot = calculateLootDelta(beforeText, afterText)
      
      if (loot.length === 0) {
        setDeltaItems([])
        return
      }

      const itemMap = new Map<string, LootItem>()
      
      loot.forEach(item => {
        const existing = itemMap.get(item.name)
        if (existing) {
          existing.quantity += item.quantity
        } else {
          itemMap.set(item.name, {
            name: item.name,
            quantity: item.quantity,
            price: 0,
            totalValue: 0
          })
        }
      })

      setIsLoadingPrices(true)
      try {
        const itemNames = Array.from(itemMap.keys())
        const { getMarketAppraisal } = await import('@/lib/market')
        const prices = await getMarketAppraisal(itemNames)

        const groupedItems: LootItem[] = []
        itemMap.forEach((item, name) => {
          const price = prices[name.toLowerCase()] || 0
          item.price = price
          item.totalValue = price * item.quantity
          groupedItems.push(item)
        })

        groupedItems.sort((a, b) => b.totalValue - a.totalValue)
        
        setDeltaItems(groupedItems)
      } catch (error) {
        console.error('Failed to fetch prices:', error)
        setDeltaItems(Array.from(itemMap.values()))
      } finally {
        setIsLoadingPrices(false)
      }
    }

    calculateAndFetchPrices()
  }, [afterText, beforeText])

  const handleSelectSite = (site: string) => {
    setSiteName(site)
    setSearchTerm('')
    setShowSiteSuggestions(false)
  }

  const handleProcess = async () => {
    if (!afterText) {
      toast.error("Paste the current cargo (After).")
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading("Calculating delta and appraising prices...")

    try {
      const loot = calculateLootDelta(beforeText, afterText)
      
      if (loot.length === 0 && beforeText !== '') {
        toast.info("No new items detected in cargo.")
      }

      const res = await fetch('/api/activities/exploration/add-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          loot,
          siteName: siteName || lastUsedSiteName || 'Exploration Site',
          spaceType,
          fullCargoAfter: afterText
        })
      })

      if (res.ok) {
        const result = await res.json()
        updateActivity(activity.id, result.activity)
        toast.success(`Site registered! +${formatISK(result.addedValue)}`, { id: toastId })
        onOpenChange(false)
      } else {
        const err = await res.text()
        toast.error(`Error saving site: ${err}`, { id: toastId })
      }
    } catch (e) {
      console.error(e)
      toast.error("Internal error processing loot.", { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  const hasLoot = deltaItems.length > 0

  const totalDeltaValue = deltaItems.reduce((sum, item) => sum + item.totalValue, 0)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-[#0a0a0f] border-zinc-800 shadow-2xl overflow-hidden p-0 max-h-[90vh] overflow-y-auto">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500" />
        
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-cyan-400" />
            REGISTER EXPLORATION SITE
          </DialogTitle>
          <DialogDescription className="text-zinc-500 text-xs mt-1">
            Compare your cargo before and after looting to calculate exact profit.
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Space</Label>
                <div className="h-10 px-3 bg-zinc-900/50 border border-zinc-800 rounded-xl flex items-center text-cyan-400 text-xs font-bold">
                  {spaceType}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Site Type</Label>
                <div className="relative">
                  <Input
                    placeholder="Search site..."
                    value={searchTerm || siteName}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setSiteName(e.target.value)
                      setShowSiteSuggestions(true)
                    }}
                    onFocus={() => setShowSiteSuggestions(true)}
                    className="bg-zinc-950/50 border-zinc-800 text-xs pr-8"
                  />
                  <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                  
                  {showSiteSuggestions && searchTerm && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 rounded-lg border border-zinc-700 bg-zinc-900 max-h-[150px] overflow-y-auto">
                      {filteredSites.length > 0 ? (
                        filteredSites.map((site) => (
                          <div
                            key={site}
                            onClick={() => handleSelectSite(site)}
                            className="cursor-pointer px-3 py-2 text-xs hover:bg-zinc-800 text-zinc-300"
                          >
                            {site}
                          </div>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-xs text-zinc-500">{t('global.noSitesFound')}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {siteName === 'Other' && (
              <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-300">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Custom Name</Label>
                <Input 
                  placeholder="Ex: Superior Sleeper Cache" 
                  className="bg-zinc-950/50 border-zinc-800 text-xs"
                  onChange={(e) => setLastUsedSiteName(e.target.value)}
                />
              </div>
            )}

            {deltaItems.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-[10px] font-black uppercase text-emerald-500 tracking-wider flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> LOOT
                  </Label>
                  {isLoadingPrices ? (
                    <span className="text-[9px] text-zinc-500">{t('global.loadingPrices')}</span>
                  ) : (
                    <span className="text-[9px] text-emerald-400 font-bold">
                      +{formatISK(totalDeltaValue)}
                    </span>
                  )}
                </div>
                <ScrollArea className="h-[120px] rounded-lg border border-zinc-800 bg-zinc-950/50 p-2">
                  <div className="space-y-1">
                    {deltaItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "flex items-center justify-between text-[10px] py-1 px-2 rounded transition-all",
                          item.totalValue >= 10000000 ? "bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.05)]" : "hover:bg-zinc-800/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Circle className={cn("h-2 w-2 fill-emerald-500 text-emerald-500", item.totalValue >= 10000000 && "animate-pulse")} />
                          <span className="text-zinc-300 font-medium">{item.quantity}x</span>
                          <span className={cn("text-zinc-400 truncate max-w-[180px]", item.totalValue >= 10000000 && "text-emerald-300 font-bold")}>
                            {item.name}
                          </span>
                        </div>
                        <span className={cn("font-mono text-[9px]", item.totalValue >= 10000000 ? "text-emerald-400 font-black" : "text-zinc-400")}>
                          {item.price > 0 ? formatISK(item.totalValue) : '...'}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="p-3 bg-zinc-900/40 rounded-xl border border-white/[0.03] space-y-2">
              <div className="flex items-center gap-2 text-zinc-400">
                <Info className="h-3 w-3" />
                <span className="text-[10px] font-medium">{t('global.inGameCargoInstructions')}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest flex items-center gap-2">
                  <History className="h-3 w-3" /> BEFORE (Previous Cargo)
                </Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-5 px-2 text-[9px] hover:bg-zinc-800"
                  onClick={() => setBeforeEditable(!beforeEditable)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
              <Textarea 
                readOnly={!beforeEditable}
                placeholder="Paste previous cargo here..."
                className={cn(
                  "flex-1 min-h-[180px] bg-zinc-950/50 border-zinc-800 text-[10px] font-mono resize-none transition-colors",
                  !beforeEditable && "opacity-60"
                )}
                value={beforeText}
                onChange={(e) => beforeEditable && setBeforeText(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label className="text-[10px] font-black uppercase text-cyan-500 tracking-widest flex items-center gap-2">
                <Plus className="h-3 w-3" /> AFTER (Current Cargo) ★
              </Label>
              <Textarea 
                placeholder="Paste CURRENT cargo here..."
                className="flex-1 min-h-[180px] bg-zinc-900/50 border border-cyan-500/30 text-[10px] font-mono resize-none focus:border-cyan-500 focus:shadow-[0_0_15px_rgba(0,191,255,0.15)] transition-all"
                value={afterText}
                onChange={(e) => setAfterText(e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-zinc-950/50 border-t border-white/[0.03] gap-3">
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-zinc-500 hover:text-white"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleProcess}
            disabled={isProcessing}
            className="px-8 bg-cyan-600 hover:bg-cyan-500 text-white font-black uppercase text-xs tracking-widest rounded-xl transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,191,255,0.2)]"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <ClipboardCopy className="h-4 w-4 mr-2" />
            )}
            {isProcessing ? 'PROCESSING...' : 'REGISTER LOOT'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}