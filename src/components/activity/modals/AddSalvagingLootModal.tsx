'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { useTranslations } from '@/i18n/hooks'
import {
  Loader2,
  HelpCircle,
  Pencil,
  MapPin,
  Package,
  ChevronDown,
} from 'lucide-react'
import { calculateLootDelta } from '@/lib/parsers/eve-cargo-parser'
import { useActivityStore } from '@/lib/stores/activity-store'
import { toast } from 'sonner'
import { formatISK, cn } from '@/lib/utils'
import { SalvagingThemedDialog, salvagingModalTheme } from './salvaging/SalvagingThemedDialog'

interface LootItem {
  name: string
  quantity: number
  price: number
  totalValue: number
}

interface AddSalvagingLootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: { id: string; space?: string; data?: { currentSpaceType?: string; lastCargoState?: string } }
}

export function AddSalvagingLootModal({
  open,
  onOpenChange,
  activity,
}: AddSalvagingLootModalProps) {
  const { t } = useTranslations()
  const theme = salvagingModalTheme
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')
  const spaceType = activity?.space || activity?.data?.currentSpaceType || 'Highsec'
  const [label, setLabel] = useState('')
  const [beforeEditable, setBeforeEditable] = useState(false)
  const [beforeSectionOpen, setBeforeSectionOpen] = useState(false)
  const [deltaDetailsOpen, setDeltaDetailsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [deltaItems, setDeltaItems] = useState<LootItem[]>([])
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)

  const { updateActivity } = useActivityStore()

  const hasSavedBefore = Boolean(activity?.data?.lastCargoState?.trim())
  const showCollapsedBefore =
    hasSavedBefore && !beforeSectionOpen && !beforeEditable

  useEffect(() => {
    if (open) {
      setAfterText('')
      setDeltaItems([])
      setBeforeText(activity?.data?.lastCargoState || '')
      setLabel('')
      setBeforeEditable(false)
      setBeforeSectionOpen(false)
      setDeltaDetailsOpen(false)
    }
  }, [open, activity?.data?.lastCargoState])

  useEffect(() => {
    if (!deltaItems.length) setDeltaDetailsOpen(false)
  }, [deltaItems.length])

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
      loot.forEach((item) => {
        const existing = itemMap.get(item.name)
        if (existing) existing.quantity += item.quantity
        else
          itemMap.set(item.name, {
            name: item.name,
            quantity: item.quantity,
            price: 0,
            totalValue: 0,
          })
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

  const totalDeltaValue = useMemo(
    () => deltaItems.reduce((sum, item) => sum + item.totalValue, 0),
    [deltaItems]
  )

  const handleProcess = async () => {
    if (!afterText) {
      toast.error(t('activity.salvaging.modals.loot.pasteAfterRequired'))
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading(t('activity.salvaging.modals.loot.processing'))

    try {
      const loot = calculateLootDelta(beforeText, afterText)
      if (loot.length === 0 && beforeText !== '') {
        toast.info(t('activity.salvaging.modals.loot.noNewItems'), { id: toastId })
        return
      }

      const res = await fetch('/api/activities/salvaging/add-loot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          loot,
          label: label.trim() || t('activity.salvaging.modals.loot.defaultLabel'),
          spaceType,
          fullCargoAfter: afterText,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        updateActivity(activity.id, result.activity)
        toast.success(
          t('activity.salvaging.modals.loot.success', { value: formatISK(result.addedValue) }),
          { id: toastId }
        )
        onOpenChange(false)
      } else {
        const err = await res.text()
        toast.error(t('activity.salvaging.modals.loot.error', { message: err }), { id: toastId })
      }
    } catch (e) {
      console.error(e)
      toast.error(t('activity.salvaging.modals.loot.internalError'), { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  const fieldClass = cn(
    'min-h-[96px] resize-y rounded-lg border bg-black/30 text-xs leading-relaxed backdrop-blur-sm',
    'border-lime-400/25 text-lime-50 placeholder:text-lime-400/35',
    'focus-visible:border-lime-400/50 focus-visible:ring-1 focus-visible:ring-lime-400/30'
  )

  return (
    <SalvagingThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.salvaging.modals.loot.badge')}
      title={t('activity.salvaging.modals.loot.title')}
      description={t('activity.salvaging.modals.loot.description')}
      maxWidth="2xl"
      scrollable
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(
              'h-9 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide text-lime-400/70 hover:text-lime-100',
              'hover:bg-lime-500/10'
            )}
          >
            {t('activity.salvaging.modals.loot.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || !afterText.trim()}
            className={cn(
              'h-9 rounded-lg border px-6 font-mono text-[10px] font-bold uppercase tracking-wide',
              'border-lime-300/50 bg-lime-400 text-black hover:bg-lime-300',
              'disabled:opacity-40'
            )}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            {isProcessing
              ? t('activity.salvaging.modals.loot.saving')
              : t('activity.salvaging.modals.loot.save')}
          </Button>
        </div>
      }
    >
      <TooltipProvider>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.salvaging.modals.loot.secLevel')}
              </Label>
              <div
                className={cn(
                  'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm',
                  theme.metricShell
                )}
              >
                <MapPin className={cn('h-4 w-4 shrink-0', theme.textMuted)} />
                <span className={theme.text}>{spaceType}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.salvaging.modals.loot.labelOptional')}
              </Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t('activity.salvaging.modals.loot.labelPlaceholder')}
                className={cn(
                  'h-9 rounded-lg border border-lime-400/25 bg-black/30 text-xs text-lime-50'
                )}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.salvaging.modals.loot.before')} / {t('activity.salvaging.modals.loot.after')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-lime-300/60 hover:bg-lime-500/15 hover:text-lime-100"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] rounded-lg border border-lime-400/25 bg-[#0c141c]/95 p-3 text-xs leading-relaxed text-lime-100/90">
                {t('global.inGameCargoInstructions')}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.salvaging.modals.loot.before')}
                </Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn(
                    'h-6 gap-1 rounded-md px-2 text-[9px] font-bold uppercase',
                    theme.chip,
                    beforeEditable && theme.chipActive
                  )}
                  onClick={() => {
                    setBeforeSectionOpen(true)
                    setBeforeEditable(true)
                  }}
                >
                  <Pencil className="h-3 w-3" />
                  {t('activity.salvaging.modals.loot.edit')}
                </Button>
              </div>
              {showCollapsedBefore ? (
                <button
                  type="button"
                  onClick={() => setBeforeSectionOpen(true)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] transition-colors',
                    'border-lime-400/20 bg-black/25 hover:border-lime-400/35 hover:bg-lime-500/10',
                    theme.textMuted
                  )}
                >
                  <span>{t('activity.salvaging.modals.loot.usingSavedCargo')}</span>
                  <span className="font-bold uppercase tracking-wide text-lime-200/90">
                    {t('activity.salvaging.modals.loot.editCargo')}
                  </span>
                </button>
              ) : (
                <Textarea
                  readOnly={!beforeEditable}
                  placeholder={t('activity.salvaging.modals.loot.beforePlaceholder')}
                  className={cn(fieldClass, !beforeEditable && 'opacity-60')}
                  value={beforeText}
                  rows={4}
                  onChange={(e) => beforeEditable && setBeforeText(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                {t('activity.salvaging.modals.loot.after')}
              </Label>
              <Textarea
                placeholder={t('activity.salvaging.modals.loot.afterPlaceholder')}
                className={cn(fieldClass, 'ring-1 ring-lime-400/25')}
                value={afterText}
                rows={4}
                onChange={(e) => setAfterText(e.target.value)}
              />
            </div>
          </div>

          {deltaItems.length > 0 ? (
            <div className={cn('rounded-lg border p-3', theme.panel)}>
              <div className="flex items-center justify-between gap-2">
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                  {t('activity.salvaging.modals.loot.deltaPreview')}
                </span>
                {isLoadingPrices ? (
                  <span className={cn('text-[10px]', theme.textMuted)}>
                    {t('activity.salvaging.modals.loot.syncingPrices')}
                  </span>
                ) : (
                  <span className={cn('text-sm font-bold tabular-nums', theme.revenuePositive)}>
                    +{formatISK(totalDeltaValue)}
                  </span>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                className={cn(
                  'mt-2 h-7 w-full justify-between rounded-md border text-[10px] font-medium',
                  'border-lime-400/15 bg-black/20 hover:bg-lime-500/10',
                  theme.textMuted
                )}
                onClick={() => setDeltaDetailsOpen((v) => !v)}
              >
                <span>
                  {deltaDetailsOpen
                    ? t('activity.salvaging.hideItemDetails')
                    : t('activity.salvaging.showItemDetails', { count: deltaItems.length })}
                </span>
                <ChevronDown
                  className={cn('h-3.5 w-3.5 transition-transform', deltaDetailsOpen && 'rotate-180')}
                />
              </Button>

              {deltaDetailsOpen ? (
                <ScrollArea className="mt-2 max-h-32">
                  <ul className="space-y-1 pr-2">
                    {deltaItems.map((item, idx) => (
                      <li
                        key={idx}
                        className={cn(
                          'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[10px]',
                          item.totalValue >= 10_000_000
                            ? 'border border-lime-400/20 bg-lime-500/10'
                            : 'bg-black/20'
                        )}
                      >
                        <span className="min-w-0 truncate text-lime-100/90">
                          <span className={theme.textMuted}>{item.quantity}× </span>
                          {item.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-lime-200/80">
                          {item.price > 0 ? formatISK(item.totalValue) : '…'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              ) : null}
            </div>
          ) : null}
        </div>
      </TooltipProvider>
    </SalvagingThemedDialog>
  )
}
