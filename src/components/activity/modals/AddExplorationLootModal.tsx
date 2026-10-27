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
import { ExplorationThemedDialog, explorationModalTheme } from './exploration/ExplorationThemedDialog'
import { ExplorationSiteSearch } from './exploration/ExplorationSiteSearch'

interface LootItem {
  name: string
  quantity: number
  price: number
  totalValue: number
}

interface AddExplorationLootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: { id: string; space?: string; data?: { currentSpaceType?: string; lastCargoState?: string } }
}

export function AddExplorationLootModal({
  open,
  onOpenChange,
  activity,
}: AddExplorationLootModalProps) {
  const { t } = useTranslations()
  const theme = explorationModalTheme
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')
  const spaceType = activity?.space || activity?.data?.currentSpaceType || 'Highsec'
  const [siteName, setSiteName] = useState('')
  const [beforeEditable, setBeforeEditable] = useState(false)
  const [beforeSectionOpen, setBeforeSectionOpen] = useState(false)
  const [deltaDetailsOpen, setDeltaDetailsOpen] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [deltaItems, setDeltaItems] = useState<LootItem[]>([])
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [lastUsedSiteName, setLastUsedSiteName] = useState('')

  const { updateActivity } = useActivityStore()

  const hasSavedBefore = Boolean(activity?.data?.lastCargoState?.trim())
  const showCollapsedBefore =
    hasSavedBefore && !beforeSectionOpen && !beforeEditable

  useEffect(() => {
    if (open) {
      setAfterText('')
      setDeltaItems([])
      setBeforeText(activity?.data?.lastCargoState || '')
      setSiteName('')
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
    if (!afterText.trim()) {
      toast.error(t('activity.exploration.modals.loot.pasteAfterRequired'))
      return
    }

    const loot = calculateLootDelta(beforeText, afterText)
    if (loot.length === 0) {
      toast.info(t('activity.exploration.modals.loot.noNewItems'))
      return
    }

    setIsProcessing(true)
    const toastId = toast.loading(t('activity.exploration.modals.loot.processing'))

    const effectiveSiteName =
      siteName === 'Other'
        ? lastUsedSiteName || t('activity.exploration.modals.loot.defaultSiteName')
        : siteName || lastUsedSiteName || t('activity.exploration.modals.loot.defaultSiteName')

    try {
      const res = await fetch('/api/activities/exploration/add-site', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityId: activity.id,
          siteName: effectiveSiteName,
          spaceType,
          fullCargoAfter: afterText,
          beforeCargo: beforeText,
        }),
      })

      if (res.ok) {
        const result = await res.json()
        updateActivity(activity.id, result.activity)
        toast.success(
          t('activity.exploration.modals.loot.success', { value: formatISK(result.addedValue) }),
          { id: toastId }
        )
        onOpenChange(false)
      } else {
        let message = res.statusText
        try {
          const errBody = await res.json()
          message = errBody.error || errBody.message || message
        } catch {
          const errText = await res.text()
          if (errText) message = errText
        }
        toast.error(t('activity.exploration.modals.loot.error', { message }), { id: toastId })
      }
    } catch (e) {
      console.error(e)
      toast.error(t('activity.exploration.modals.loot.internalError'), { id: toastId })
    } finally {
      setIsProcessing(false)
    }
  }

  const fieldClass = cn(
    'min-h-[96px] resize-y rounded-lg border bg-black/30 text-xs leading-relaxed backdrop-blur-sm',
    'border-orange-400/25 text-orange-50 placeholder:text-orange-400/35',
    'focus-visible:border-orange-400/50 focus-visible:ring-1 focus-visible:ring-orange-400/30'
  )

  return (
    <ExplorationThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.exploration.modals.loot.badge')}
      title={t('activity.exploration.modals.loot.title')}
      description={t('activity.exploration.modals.loot.description')}
      maxWidth="2xl"
      scrollable
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className={cn(
              'h-9 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide text-orange-400/70 hover:text-orange-100',
              'hover:bg-orange-500/10'
            )}
          >
            {t('activity.exploration.modals.loot.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleProcess}
            disabled={isProcessing || !afterText.trim() || deltaItems.length === 0 || isLoadingPrices}
            className={cn(
              'h-9 rounded-lg border px-6 font-mono text-[10px] font-bold uppercase tracking-wide',
              'border-orange-300/50 bg-orange-400 text-black hover:bg-orange-300',
              'disabled:opacity-40'
            )}
          >
            {isProcessing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Package className="mr-2 h-4 w-4" />
            )}
            {isProcessing
              ? t('activity.exploration.modals.loot.saving')
              : t('activity.exploration.modals.loot.save')}
          </Button>
        </div>
      }
    >
      <TooltipProvider>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.exploration.modals.loot.secLevel')}
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
            <ExplorationSiteSearch
              label={t('activity.exploration.modals.loot.siteLabel')}
              placeholder={t('activity.exploration.modals.loot.sitePlaceholder')}
              value={siteName}
              onValueChange={setSiteName}
              onSelect={setSiteName}
              emptyMessage={t('activity.exploration.modals.loot.noMatches')}
            />
          </div>

          {siteName === 'Other' ? (
            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.exploration.modals.loot.customSite')}
              </Label>
              <Input
                placeholder={t('activity.exploration.modals.loot.customSitePlaceholder')}
                className={cn(
                  'h-9 rounded-lg border border-orange-400/25 bg-black/30 text-xs text-orange-50'
                )}
                onChange={(e) => setLastUsedSiteName(e.target.value)}
              />
            </div>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.exploration.modals.loot.before')} / {t('activity.exploration.modals.loot.after')}
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-orange-300/60 hover:bg-orange-500/15 hover:text-orange-100"
                >
                  <HelpCircle className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-[260px] rounded-lg border border-orange-400/25 bg-[#0c141c]/95 p-3 text-xs leading-relaxed text-orange-100/90">
                {t('global.inGameCargoInstructions')}
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                  {t('activity.exploration.modals.loot.before')}
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
                  {t('activity.exploration.modals.loot.edit')}
                </Button>
              </div>
              {showCollapsedBefore ? (
                <button
                  type="button"
                  onClick={() => setBeforeSectionOpen(true)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[10px] transition-colors',
                    'border-orange-400/20 bg-black/25 hover:border-orange-400/35 hover:bg-orange-500/10',
                    theme.textMuted
                  )}
                >
                  <span>{t('activity.exploration.modals.loot.usingSavedCargo')}</span>
                  <span className="font-bold uppercase tracking-wide text-orange-200/90">
                    {t('activity.exploration.modals.loot.editCargo')}
                  </span>
                </button>
              ) : (
                <Textarea
                  readOnly={!beforeEditable}
                  placeholder={t('activity.exploration.modals.loot.beforePlaceholder')}
                  className={cn(fieldClass, !beforeEditable && 'opacity-60')}
                  value={beforeText}
                  rows={4}
                  onChange={(e) => beforeEditable && setBeforeText(e.target.value)}
                />
              )}
            </div>

            <div className="space-y-1.5">
              <Label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                {t('activity.exploration.modals.loot.after')}
              </Label>
              <Textarea
                placeholder={t('activity.exploration.modals.loot.afterPlaceholder')}
                className={cn(fieldClass, 'ring-1 ring-orange-400/25')}
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
                  {t('activity.exploration.modals.loot.deltaPreview')}
                </span>
                {isLoadingPrices ? (
                  <span className={cn('text-[10px]', theme.textMuted)}>
                    {t('activity.exploration.modals.loot.syncingPrices')}
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
                  'border-orange-400/15 bg-black/20 hover:bg-orange-500/10',
                  theme.textMuted
                )}
                onClick={() => setDeltaDetailsOpen((v) => !v)}
              >
                <span>
                  {deltaDetailsOpen
                    ? t('activity.exploration.hideItemDetails')
                    : t('activity.exploration.showItemDetails', { count: deltaItems.length })}
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
                            ? 'border border-orange-400/20 bg-orange-500/10'
                            : 'bg-black/20'
                        )}
                      >
                        <span className="min-w-0 truncate text-orange-100/90">
                          <span className={theme.textMuted}>{item.quantity}× </span>
                          {item.name}
                        </span>
                        <span className="shrink-0 tabular-nums text-orange-200/80">
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
    </ExplorationThemedDialog>
  )
}
