'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from '@/i18n/hooks'
import { calculateAbyssalDelta } from '@/lib/parsers/eve-cargo-parser'
import { formatISK } from '@/lib/utils'
import { ArrowRight, Info } from 'lucide-react'
import { getMarketAppraisal } from '@/lib/market'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'

interface AbyssalLootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (payload: {
    lootItems: any[]
    consumedItems: any[]
    netValue: number
    beforeCargoState: string
    afterCargoState: string
    tier: string
    weather: string
    ship: string
  }) => void
  lastCargoState?: string
  initialData?: {
    beforeText?: string
    afterText?: string
    tier?: string
    weather?: string
    ship?: string
    lootValue?: number
    beforeCargoState?: string
    afterCargoState?: string
  }
  defaultTier?: string
  defaultWeather?: string
  defaultShip?: string
}

export function AbyssalLootModal({
  open,
  onOpenChange,
  onSave,
  lastCargoState = '',
  initialData,
  defaultTier = 'T6 (Cataclysmic)',
  defaultWeather = 'Electrical',
  defaultShip = 'Undefined',
}: AbyssalLootModalProps) {
  const { t } = useTranslations()
  const [beforeText, setBeforeText] = useState(initialData?.beforeText || lastCargoState)
  const [afterText, setAfterText] = useState(initialData?.afterText || '')
  const [preview, setPreview] = useState<{ loot: any[], consumed: any[], netValue: number } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [tier, setTier] = useState(initialData?.tier || defaultTier)
  const [weather, setWeather] = useState(initialData?.weather || defaultWeather)
  const [ship, setShip] = useState(initialData?.ship || defaultShip)

  useEffect(() => {
    if (open) {
      setBeforeText(initialData?.beforeText || lastCargoState || '')
      setAfterText(initialData?.afterText || '')
      setTier(initialData?.tier || defaultTier || 'T6 (Cataclysmic)')
      setWeather(initialData?.weather || defaultWeather || 'Electrical')
      setShip(initialData?.ship || defaultShip || 'Undefined')
    }
  }, [open])

  // Auto-calculate on text change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (afterText.trim()) {
        handleCalculate()
      } else {
        setPreview(null)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [afterText, beforeText])

  const handleCalculate = async () => {
    if (!afterText.trim()) return
    setIsCalculating(true)
    
    try {
      const { loot, consumed } = calculateAbyssalDelta(beforeText, afterText)
      const allNames = Array.from(new Set([...loot.map(i => i.name), ...consumed.map(i => i.name)]))
      const prices = await getMarketAppraisal(allNames)
      
      let totalLootValue = 0
      const lootWithPrices = loot.map(item => {
        const price = prices[item.name.toLowerCase()] || 0
        const value = price * item.quantity
        totalLootValue += value
        return { ...item, price, value }
      })
      
      let totalConsumedValue = 0
      const consumedWithPrices = consumed.map(item => {
        const price = prices[item.name.toLowerCase()] || 0
        const value = price * item.quantity
        totalConsumedValue += value
        return { ...item, price, value }
      })
      
      setPreview({
        loot: lootWithPrices,
        consumed: consumedWithPrices,
        netValue: totalLootValue - totalConsumedValue
      })
    } catch (error) {
      console.error('Calculation error:', error)
    } finally {
      setIsCalculating(false)
    }
  }

  const handleSave = () => {
    onSave({
      lootItems: preview?.loot || [],
      consumedItems: preview?.consumed || [],
      netValue: preview?.netValue || 0,
      beforeCargoState: beforeText,
      afterCargoState: afterText,
      tier,
      weather,
      ship,
    })
    onOpenChange(false)
    setAfterText('')
    setPreview(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
        <DialogHeader>
          <DialogTitle className="text-xl font-black text-white uppercase tracking-tight">
            Abyssal Registration
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Register your loot and consumed items for this run.
          </DialogDescription>
        </DialogHeader>

        <TooltipProvider>
          <div className="space-y-6 py-4">
            <div className="flex gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1 flex items-center gap-1">
                  Before Run (Cargo)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-zinc-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[11px] bg-zinc-900 border-zinc-800 text-zinc-300">
                      Paste your inventory content BEFORE starting the run.
                    </TooltipContent>
                  </Tooltip>
                </label>
                <Textarea
                  value={beforeText}
                  onChange={(e) => setBeforeText(e.target.value)}
                  placeholder="Paste inventory here..."
                  className="bg-zinc-950 border-zinc-800 text-zinc-300 font-mono text-[11px] h-32 resize-none focus-visible:ring-fuchsia-500/30"
                />
              </div>

              <div className="flex-1 space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1 flex items-center gap-1">
                  After Run (Cargo)
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-zinc-600 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-[11px] bg-zinc-900 border-zinc-800 text-zinc-300">
                      Paste your inventory content AFTER finishing the run. Loot will be calculated automatically.
                    </TooltipContent>
                  </Tooltip>
                </label>
                <Textarea
                  value={afterText}
                  onChange={(e) => setAfterText(e.target.value)}
                  placeholder="Paste inventory here..."
                  className={`bg-zinc-950 border-zinc-800 text-zinc-300 font-mono text-[11px] h-32 resize-none focus-visible:ring-fuchsia-500/30 ${isCalculating ? 'animate-pulse' : ''} ${afterText && preview && preview.loot.length === 0 && preview.consumed.length === 0 ? 'border-amber-500/50' : ''}`}
                />
                {afterText && preview && preview.loot.length === 0 && preview.consumed.length === 0 && (
                  <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-1">
                    <Info className="h-3 w-3" />
                    No changes detected between Before and After.
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Tier</label>
                <Select value={tier} onValueChange={setTier}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ABYSSAL_TIERS.map((tValue: any) => (
                      <SelectItem key={tValue.label} value={tValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={tValue.iconPath} />
                            <AvatarFallback className="text-[8px]">T</AvatarFallback>
                          </Avatar>
                          <span>{tValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase font-bold text-zinc-500 ml-1">Weather</label>
                <Select value={weather} onValueChange={setWeather}>
                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ABYSSAL_WEATHER.map((wValue: any) => (
                      <SelectItem key={wValue.label} value={wValue.label}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded-sm">
                            <AvatarImage src={wValue.iconPath} />
                            <AvatarFallback className="text-[8px]">W</AvatarFallback>
                          </Avatar>
                          <span>{wValue.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500">Ship</label>
              </div>
              <Input
                value={ship}
                onChange={(e) => setShip(e.target.value)}
                placeholder="Ship used (e.g. Gila)"
                className="bg-zinc-900 border-zinc-800 text-zinc-200"
              />
            </div>

            {preview && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-emerald-400 tracking-wider flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Loot Detected
                    </p>
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 max-h-[150px] overflow-y-auto custom-scrollbar space-y-1">
                      {preview.loot.length > 0 ? preview.loot.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                          <span className="text-zinc-300 truncate max-w-[120px]">{item.name} x{item.quantity}</span>
                          <span className="text-emerald-400 font-mono">{formatISK(item.value)}</span>
                        </div>
                      )) : (
                        <p className="text-[10px] text-zinc-600 italic">No loot detected</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-[10px] uppercase font-black text-red-400 tracking-wider flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      Consumed
                    </p>
                    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3 max-h-[150px] overflow-y-auto custom-scrollbar space-y-1">
                      {preview.consumed.length > 0 ? preview.consumed.map((item, i) => (
                        <div key={i} className="flex justify-between text-[10px]">
                          <span className="text-zinc-300 truncate max-w-[120px]">{item.name} x{item.quantity}</span>
                          <span className="text-red-400 font-mono">-{formatISK(item.value)}</span>
                        </div>
                      )) : (
                        <p className="text-[10px] text-zinc-600 italic">No items consumed</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500/10 via-zinc-900 to-emerald-500/10 border border-white/10 rounded-2xl p-4 flex items-center justify-between mt-2">
                  <div>
                    <p className="text-[10px] uppercase font-black text-zinc-500 tracking-widest mb-1">Net Loot Value</p>
                    <p className={`text-2xl font-black font-mono tracking-tighter ${preview.netValue >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {formatISK(preview.netValue)}
                    </p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-zinc-700" />
                </div>
              </div>
            )}
          </div>
        </TooltipProvider>

        <DialogFooter className="mt-4 gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white uppercase font-black text-xs">
            Cancel
          </Button>
          <Button 
            disabled={!preview || isCalculating} 
            onClick={handleSave}
            className="bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-black uppercase tracking-widest px-8"
          >
            {isCalculating ? 'Calculating...' : 'Register Run'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
