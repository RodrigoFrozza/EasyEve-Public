'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTranslations } from '@/i18n/hooks'
import { calculateAbyssalDelta } from '@/lib/parsers/eve-cargo-parser'
import { formatISK, cn } from '@/lib/utils'
import { Info, Pencil } from 'lucide-react'
import { getMarketAppraisalWithIds } from '@/lib/market'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { getActivityTheme } from '@/lib/activity/activity-theme'
import { AbyssalThemedDialog } from './abyssal/AbyssalThemedDialog'

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
  const theme = getActivityTheme('abyssal')
  const [beforeText, setBeforeText] = useState(initialData?.beforeText || lastCargoState)
  const [afterText, setAfterText] = useState(initialData?.afterText || '')
  const [preview, setPreview] = useState<{ loot: any[]; consumed: any[]; netValue: number } | null>(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [tier, setTier] = useState(initialData?.tier || defaultTier)
  const [weather, setWeather] = useState(initialData?.weather || defaultWeather)
  const [ship, setShip] = useState(initialData?.ship || defaultShip)
  const [isBeforeCargoEditable, setIsBeforeCargoEditable] = useState(false)

  const fieldClass = cn(
    'rounded-lg border border-purple-400/25 bg-black/30 text-purple-50',
    'text-xs focus-visible:ring-1 focus-visible:ring-purple-400/35'
  )

  useEffect(() => {
    if (open) {
      setBeforeText(initialData?.beforeText || lastCargoState || '')
      setAfterText(initialData?.afterText || '')
      setTier(initialData?.tier || defaultTier || 'T6 (Cataclysmic)')
      setWeather(initialData?.weather || defaultWeather || 'Electrical')
      setShip(initialData?.ship || defaultShip || 'Undefined')
      setPreview(null)
    }
    // initialData is a parent snapshot captured at open time only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const handleCalculate = useCallback(async () => {
    if (!afterText.trim()) return
    setIsCalculating(true)

    try {
      const { loot, consumed } = calculateAbyssalDelta(beforeText, afterText)
      const allNames = Array.from(new Set([...loot.map((i) => i.name), ...consumed.map((i) => i.name)]))
      const priceData = await getMarketAppraisalWithIds(allNames)

      let totalLootValue = 0
      const lootWithPrices = loot.map((item) => {
        const itemInfo = priceData[item.name.toLowerCase()]
        const price = itemInfo?.price || 0
        const id = itemInfo?.id
        const value = price * item.quantity
        totalLootValue += value
        return { ...item, price, value, id, typeId: id }
      })

      let totalConsumedValue = 0
      const consumedWithPrices = consumed.map((item) => {
        const itemInfo = priceData[item.name.toLowerCase()]
        const price = itemInfo?.price || 0
        const id = itemInfo?.id
        const value = price * item.quantity
        totalConsumedValue += value
        return { ...item, price, value, id, typeId: id }
      })

      setPreview({
        loot: lootWithPrices,
        consumed: consumedWithPrices,
        netValue: totalLootValue - totalConsumedValue,
      })
    } catch (error) {
      console.error('Calculation error:', error)
    } finally {
      setIsCalculating(false)
    }
  }, [afterText, beforeText])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (afterText.trim()) {
        void handleCalculate()
      } else {
        setPreview(null)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [afterText, beforeText, handleCalculate])

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

  const footer = (
    <div className="flex flex-wrap justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onOpenChange(false)}
        className={cn('h-9 text-xs', theme.textMuted, 'hover:text-purple-100')}
      >
        {t('activity.abyssal.modals.loot.cancel')}
      </Button>
      <Button
        type="button"
        disabled={!preview || isCalculating}
        onClick={handleSave}
        className={cn(
          'h-9 border px-6 text-xs font-bold uppercase tracking-wide',
          'border-purple-300/50 bg-purple-500 text-white hover:bg-purple-400'
        )}
      >
        {isCalculating
          ? t('activity.abyssal.modals.loot.calculating')
          : t('activity.abyssal.modals.loot.save')}
      </Button>
    </div>
  )

  return (
    <AbyssalThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.abyssal.modals.loot.badge')}
      title={t('activity.abyssal.modals.loot.title')}
      description={t('activity.abyssal.modals.loot.description')}
      maxWidth="2xl"
      footer={footer}
    >
      <TooltipProvider>
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label
                className={cn(
                  'flex items-center justify-between text-[10px] font-bold uppercase tracking-wide',
                  theme.textMuted
                )}
              >
                <span className="flex items-center gap-1">
                  {t('activity.abyssal.beforeCargo')}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 cursor-help opacity-50" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px] rounded-lg border border-purple-400/25 bg-[#0c141c] text-xs text-purple-100">
                      {t('activity.abyssal.modals.loot.beforeCargoHint')}
                    </TooltipContent>
                  </Tooltip>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-purple-300/50 hover:text-purple-100"
                  onClick={() => setIsBeforeCargoEditable(!isBeforeCargoEditable)}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </label>
              <Textarea
                value={beforeText}
                onChange={(e) => setBeforeText(e.target.value)}
                readOnly={!isBeforeCargoEditable}
                placeholder={t('activity.abyssal.modals.loot.noCargoSaved')}
                className={cn(fieldClass, 'min-h-[120px] resize-none font-mono', !isBeforeCargoEditable && 'opacity-60')}
              />
            </div>

            <div className="space-y-2">
              <label
                className={cn(
                  'flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide',
                  theme.textMuted
                )}
              >
                {t('activity.abyssal.afterCargo')}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 cursor-help opacity-50" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[220px] rounded-lg border border-purple-400/25 bg-[#0c141c] text-xs text-purple-100">
                    {t('activity.abyssal.modals.loot.afterCargoHint')}
                  </TooltipContent>
                </Tooltip>
              </label>
              <Textarea
                value={afterText}
                onChange={(e) => setAfterText(e.target.value)}
                placeholder={t('activity.abyssal.pasteCargoHint')}
                className={cn(fieldClass, 'min-h-[120px] resize-none font-mono', isCalculating && 'opacity-60')}
              />
              {afterText && preview && preview.loot.length === 0 && preview.consumed.length === 0 && (
                <p className="text-[10px] text-amber-300/90">
                  {t('activity.abyssal.modals.loot.noChangesDetected')}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.abyssal.tier')}
              </label>
              <Select value={tier} onValueChange={setTier}>
                <SelectTrigger className={cn('h-9 text-xs', fieldClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-purple-400/25 bg-[#0c141c]">
                  {ABYSSAL_TIERS.map((tValue: { label: string; iconPath: string }) => (
                    <SelectItem key={tValue.label} value={tValue.label}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4 rounded-none">
                          <AvatarImage src={tValue.iconPath} />
                          <AvatarFallback className="text-[8px]">T</AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] font-bold uppercase">{tValue.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.abyssal.weather')}
              </label>
              <Select value={weather} onValueChange={setWeather}>
                <SelectTrigger className={cn('h-9 text-xs', fieldClass)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-purple-400/25 bg-[#0c141c]">
                  {ABYSSAL_WEATHER.map((wValue: { label: string; iconPath: string }) => (
                    <SelectItem key={wValue.label} value={wValue.label}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-4 w-4 rounded-none">
                          <AvatarImage src={wValue.iconPath} />
                          <AvatarFallback className="text-[8px]">W</AvatarFallback>
                        </Avatar>
                        <span className="text-[10px] font-bold uppercase">{wValue.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.abyssal.ship')}
              </label>
              <Input
                value={ship}
                onChange={(e) => setShip(e.target.value)}
                placeholder={t('activity.abyssal.shipPlaceholder')}
                className={cn('h-9 text-[10px]', fieldClass)}
              />
            </div>
          </div>

          {preview && (
            <div className="space-y-3 border-t border-purple-400/15 pt-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-[10px] font-medium text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {t('activity.abyssal.modals.loot.lootGained')}
                  </p>
                  <div className="max-h-[140px] space-y-1 overflow-y-auto rounded-lg border border-emerald-500/25 bg-emerald-500/[0.04] p-2 custom-scrollbar">
                    {preview.loot.length > 0 ? (
                      preview.loot.map((item, i) => (
                        <div key={i} className="flex justify-between gap-2 text-[10px]">
                          <span className={cn('truncate', theme.textMuted)}>
                            {item.name} x{item.quantity}
                          </span>
                          <span className="shrink-0 font-mono text-emerald-300">{formatISK(item.value)}</span>
                        </div>
                      ))
                    ) : (
                      <p className={cn('text-[10px] italic', theme.textMuted)}>
                        {t('activity.abyssal.modals.loot.noItems')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="flex items-center gap-2 text-[10px] font-medium text-red-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                    {t('activity.abyssal.modals.loot.itemsConsumed')}
                  </p>
                  <div className="max-h-[140px] space-y-1 overflow-y-auto rounded-lg border border-red-500/25 bg-red-500/[0.04] p-2 custom-scrollbar">
                    {preview.consumed.length > 0 ? (
                      preview.consumed.map((item, i) => (
                        <div key={i} className="flex justify-between gap-2 text-[10px]">
                          <span className={cn('truncate', theme.textMuted)}>
                            {item.name} x{item.quantity}
                          </span>
                          <span className="shrink-0 font-mono text-red-300">-{formatISK(item.value)}</span>
                        </div>
                      ))
                    ) : (
                      <p className={cn('text-[10px] italic', theme.textMuted)}>
                        {t('activity.abyssal.modals.loot.noItems')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className={cn(theme.metricShell, 'flex items-center justify-between px-4 py-3')}>
                <div>
                  <p className={cn('text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
                    {t('activity.abyssal.modals.loot.netProfit')}
                  </p>
                  <p
                    className={cn(
                      'text-xl font-black font-mono tabular-nums',
                      preview.netValue >= 0 ? 'text-emerald-400' : 'text-red-400'
                    )}
                  >
                    {formatISK(preview.netValue)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </AbyssalThemedDialog>
  )
}
