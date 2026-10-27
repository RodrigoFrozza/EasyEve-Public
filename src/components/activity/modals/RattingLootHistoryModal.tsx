'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { getMarketAppraisalDetailed } from '@/lib/market'
import { parseEVECargoEntries } from '@/lib/parsers/eve-cargo-parser'
import { formatISK, cn } from '@/lib/utils'
import { RattingLootEntryDetailModal } from './RattingLootEntryDetailModal'
import { RattingThemedDialog, rattingModalTheme } from './ratting/RattingThemedDialog'
import { toast } from 'sonner'
import {
  Loader2,
  ClipboardCopy,
  Info,
  Package,
  ArrowUpDown,
  ChevronRight,
  Trash2,
  Recycle,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'
import {
  appendManualLootEntry,
  appendMtuEntry,
  appendSalvageEntry,
  deleteManualEntry,
  type RattingActivityData,
  type RattingLogEntry,
  type RattingLootItem,
} from '@/lib/activities/ratting-manual-entries'
import { useActivityStore } from '@/lib/stores/activity-store'

interface RattingLootHistoryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: { id: string; data?: Record<string, unknown> }
  onRefresh: () => void
  onDataChange?: (data: RattingActivityData) => void
}

type SortColumn = 'name' | 'unitPrice' | 'totalValue'
type ModalTab = 'loot' | 'mtu' | 'salvage'

type PreviewItem = {
  name: string
  quantity: number
  typeId: number
  unitPrice: number
  totalValue: number
  source: string
}

export function RattingLootHistoryModal({
  open,
  onOpenChange,
  activity,
  onRefresh,
  onDataChange,
}: RattingLootHistoryModalProps) {
  const { t } = useTranslations()
  const theme = rattingModalTheme
  const [activeTab, setActiveTab] = useState<ModalTab>('loot')
  const [clipboardText, setClipboardText] = useState('')
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>('totalValue')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<Record<string, unknown> | null>(null)

  const data = (activity.data || {}) as RattingActivityData

  const isAutoLootTrackingEnabled = data.autoLootTrackingEnabled === true
  const lastLootSyncError = (
    data.lootSyncErrors as Array<{ message: string; timestamp: string }> | undefined
  )?.[0]

  const persistData = useCallback(
    async (updatedData: RattingActivityData, deletedLogRefIds?: string[]) => {
      useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData, deletedLogRefIds }),
      })
      if (!response.ok) throw new Error('Failed to persist')

      const saved = await response.json()
      if (saved?.discarded) {
        return saved
      }

      const serverData = (saved?.data ?? updatedData) as RattingActivityData
      useActivityStore.getState().updateActivity(activity.id, { data: serverData })
      onDataChange?.(serverData)
      onRefresh()
      return serverData
    },
    [activity.id, onDataChange, onRefresh]
  )

  const previewTotal = useMemo(
    () => previewItems.reduce((sum, item) => sum + (item.totalValue || 0), 0),
    [previewItems]
  )

  const sortedPreview = useMemo(() => {
    const next = [...previewItems]
    next.sort((a, b) => {
      const av = a[sortColumn] ?? 0
      const bv = b[sortColumn] ?? 0
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
      }
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
    })
    return next
  }, [previewItems, sortAsc, sortColumn])

  const lootHistoryEntries = useMemo(
    () =>
      (data.logs || [])
        .filter((log) => log.type === 'loot')
        .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()),
    [data.logs]
  )

  const mtuHistoryEntries = useMemo(
    () =>
      (data.logs || [])
        .filter((log) => log.type === 'mtu')
        .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()),
    [data.logs]
  )

  const salvageHistoryEntries = useMemo(
    () =>
      (data.logs || [])
        .filter((log) => log.type === 'salvage')
        .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()),
    [data.logs]
  )

  const autoLootHistoryEntries = useMemo(
    () =>
      (data.logs || [])
        .filter((log) => log.type === 'loot-auto')
        .sort((a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()),
    [data.logs]
  )

  const handlePreview = useCallback(async (text: string) => {
    const parsed = parseEVECargoEntries(text)
    const entries = Array.from(parsed.values())
    if (entries.length === 0) {
      setPreviewItems([])
      return
    }
    setIsLoading(true)
    try {
      const names = entries.map((entry) => entry.displayName)
      const appraisal = await getMarketAppraisalDetailed(names)
      const items: PreviewItem[] = entries.map((entry) => {
        const name = entry.displayName
        const qty = entry.quantity
        const lookup =
          appraisal[name.toLowerCase()] ||
          appraisal[name] || {
            unitPrice: 0,
            source: 'not_found',
            typeId: 0,
          }
        return {
          name,
          quantity: qty,
          typeId: lookup.typeId,
          unitPrice: lookup.unitPrice,
          totalValue: (lookup.unitPrice || 0) * qty,
          source: lookup.source,
        }
      })
      setPreviewItems(items)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (clipboardText.trim()) {
      const timer = setTimeout(() => handlePreview(clipboardText), 300)
      return () => clearTimeout(timer)
    }
    setPreviewItems([])
  }, [clipboardText, handlePreview])

  useEffect(() => {
    if (!open) {
      setActiveTab('loot')
      setClipboardText('')
      setPreviewItems([])
      setSelectedEntry(null)
    }
  }, [open])

  useEffect(() => {
    setClipboardText('')
    setPreviewItems([])
  }, [activeTab])

  const registerEntry = (source: ModalTab, items: RattingLootItem[], amount: number): RattingActivityData => {
    if (source === 'mtu') {
      return appendMtuEntry(data, items, t('activity.ratting.mtuRegistration'))
    }
    if (source === 'salvage') {
      return appendSalvageEntry(data, items, t('activity.ratting.salvageCollection'))
    }
    return appendManualLootEntry(data, items, amount, t('activity.ratting.modals.loot.manualEntry'))
  }

  const registerSuccessKey: Record<ModalTab, string> = {
    loot: 'activity.ratting.modals.loot.registerSuccess',
    mtu: 'activity.ratting.modals.loot.mtuSaved',
    salvage: 'activity.ratting.modals.loot.salvageSaved',
  }

  const registerButtonLabelKey: Record<ModalTab, string> = {
    loot: 'activity.ratting.modals.loot.register',
    mtu: 'activity.ratting.modals.loot.addMtu',
    salvage: 'activity.ratting.modals.loot.addSalvage',
  }

  const handleRegister = async () => {
    if (previewItems.length === 0) return

    if (isAutoLootTrackingEnabled) {
      toast.warning(t('activity.ratting.modals.loot.autoTrackingWarning'), {
        description: t('activity.ratting.modals.loot.autoTrackingHint'),
      })
    }

    setIsRegistering(true)
    try {
      const amount = previewItems.reduce((sum, item) => sum + (item.totalValue || 0), 0)
      const updatedData = registerEntry(activeTab, previewItems as RattingLootItem[], amount)
      await persistData(updatedData)
      setClipboardText('')
      setPreviewItems([])
      toast.success(t(registerSuccessKey[activeTab], { value: formatISK(amount) }))
    } catch {
      toast.error(t('activity.ratting.modals.loot.registerError'))
    } finally {
      setIsRegistering(false)
    }
  }

  const confirmDelete = (entry: RattingLogEntry, type: 'loot' | 'mtu' | 'salvage') => {
    if (!entry.refId) return
    toast(t('common.deleteConfirmTitle'), {
      description: t('common.deleteConfirmDesc'),
      action: {
        label: t('common.delete'),
        onClick: () => void handleDelete(entry.refId!, type),
      },
      cancel: {
        label: t('common.cancel'),
        onClick: () => {},
      },
      duration: 8000,
    })
  }

  const handleDelete = async (refId: string, type: 'loot' | 'mtu' | 'salvage') => {
    if (isDeleting) return
    setIsDeleting(refId)
    try {
      const updatedData = deleteManualEntry(data, refId, type)
      if (!updatedData) {
        toast.error(t('common.error'))
        return
      }
      await persistData(updatedData, [refId])
      toast.success(t('common.deleted'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setIsDeleting(null)
    }
  }

  const toggleSort = (column: SortColumn) => {
    if (sortColumn === column) setSortAsc((s) => !s)
    else {
      setSortColumn(column)
      setSortAsc(false)
    }
  }

  const entryTypeLabel = (type: string) => {
    if (type === 'loot-auto') return t('activity.ratting.modals.loot.entryAuto')
    if (type === 'salvage' || type === 'mtu') return t('activity.ratting.modals.loot.entryField')
    return t('activity.ratting.modals.loot.entryManual')
  }

  const textareaClass = cn(
    'min-h-[140px] resize-y rounded-lg border bg-black/30 text-xs leading-relaxed backdrop-blur-sm sm:min-h-[160px] sm:text-sm',
    'border-red-400/25 text-red-50 placeholder:text-red-300/35',
    'focus-visible:border-red-400/50 focus-visible:ring-1 focus-visible:ring-red-400/30'
  )

  const SortHeader = ({
    column,
    label,
    align = 'left',
    className,
  }: {
    column: SortColumn
    label: string
    align?: 'left' | 'right'
    className?: string
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(column)}
      className={cn(
        'flex items-center gap-0.5 font-bold uppercase tracking-wide transition-colors hover:text-red-200',
        align === 'right' && 'ml-auto',
        sortColumn === column ? 'text-red-200' : theme.textMuted,
        className
      )}
    >
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  )

  const tabClass = (tab: ModalTab) =>
    cn(
      'flex-1 rounded-lg border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-wide transition-colors',
      activeTab === tab
        ? 'border-red-400/50 bg-red-500/20 text-red-100'
        : 'border-red-500/15 bg-transparent text-red-300/50 hover:border-red-400/30 hover:text-red-200'
    )

  const renderHistoryRow = (
    entry: RattingLogEntry,
    options: { deletable: boolean; deleteType?: 'loot' | 'mtu' | 'salvage' }
  ) => (
    <li key={String(entry.refId || entry.date)} className="group/history-row">
      <div
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-3 transition-colors',
          theme.historyRow,
          'hover:bg-red-500/[0.06]'
        )}
      >
        <button
          type="button"
          onClick={() => setSelectedEntry(entry as unknown as Record<string, unknown>)}
          className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn('text-xs font-semibold', theme.text)}>
                {entryTypeLabel(String(entry.type))}
              </span>
              <span className="text-[10px] text-red-300/50">
                <FormattedDate date={String(entry.date)} mode="datetime" />
              </span>
            </div>
            <p className="mt-0.5 truncate text-[10px] text-red-300/55">
              {String(entry.charName || t('activity.ratting.modals.loot.unknownPilot'))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className={cn('text-sm font-bold tabular-nums', theme.revenuePositive)}>
              {formatISK(Number(entry.amount) || 0)}
            </span>
            <ChevronRight
              className={cn('h-4 w-4 opacity-40 transition-opacity group-hover/history-row:opacity-100', theme.chevron)}
            />
          </div>
        </button>
        {options.deletable && entry.refId && options.deleteType ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              confirmDelete(entry, options.deleteType!)
            }}
            disabled={isDeleting === entry.refId}
            className="shrink-0 rounded-lg p-2 text-red-300/35 opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover/history-row:opacity-100 disabled:opacity-50"
            aria-label={t('common.delete')}
          >
            {isDeleting === entry.refId ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
      </div>
    </li>
  )

  const renderHistoryList = (
    entries: RattingLogEntry[],
    emptyKey: string,
    options: { deletable: boolean; deleteType?: 'loot' | 'mtu' | 'salvage' }
  ) =>
    entries.length > 0 ? (
      <ul className="divide-y divide-red-500/10 p-1">{entries.map((e) => renderHistoryRow(e, options))}</ul>
    ) : (
      <div
        className={cn(
          'flex min-h-[100px] flex-col items-center justify-center border-t border-dashed px-4 py-8 text-center',
          theme.logEmpty
        )}
      >
        <p className={cn('text-xs', theme.textMuted)}>{t(emptyKey)}</p>
      </div>
    )

  return (
    <>
      <RattingThemedDialog
        open={open && !selectedEntry}
        onOpenChange={onOpenChange}
        badge={t('activity.ratting.modals.loot.badge')}
        title={t('activity.ratting.modals.loot.title')}
        description={t('activity.ratting.modals.loot.description')}
        maxWidth="4xl"
        scrollable
        headerExtra={
          isAutoLootTrackingEnabled ? (
            <Badge
              variant="outline"
              className="border-red-400/35 bg-red-500/15 text-[10px] font-bold uppercase tracking-wide text-red-200"
            >
              {t('activity.ratting.modals.loot.autoTrackingBadge')}
            </Badge>
          ) : null
        }
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className={cn(
                'h-10 rounded-lg font-mono text-[10px] font-bold uppercase tracking-wide text-red-300/70 hover:text-red-100',
                'hover:bg-red-500/10'
              )}
            >
              {t('activity.ratting.modals.common.close')}
            </Button>
            <Button
              type="button"
              onClick={handleRegister}
              disabled={isRegistering || previewItems.length === 0}
              className={cn(
                'h-10 rounded-lg border px-6 font-mono text-[10px] font-bold uppercase tracking-wide',
                'border-red-300/50 bg-red-500 text-white hover:bg-red-400',
                'disabled:opacity-40'
              )}
            >
              {isRegistering ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : activeTab === 'salvage' ? (
                <Recycle className="mr-2 h-4 w-4" />
              ) : (
                <Package className="mr-2 h-4 w-4" />
              )}
              {isRegistering
                ? t('activity.ratting.modals.loot.registering')
                : t(registerButtonLabelKey[activeTab])}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div className="flex gap-2">
            <button type="button" className={tabClass('loot')} onClick={() => setActiveTab('loot')}>
              {t('activity.ratting.modals.loot.tabLoot')}
            </button>
            <button type="button" className={tabClass('mtu')} onClick={() => setActiveTab('mtu')}>
              {t('activity.ratting.modals.loot.tabMtu')}
            </button>
            <button type="button" className={tabClass('salvage')} onClick={() => setActiveTab('salvage')}>
              {t('activity.ratting.modals.loot.tabSalvage')}
            </button>
          </div>

          {isAutoLootTrackingEnabled && lastLootSyncError && (
            <div
              className={cn(
                'flex gap-3 rounded-lg border px-3 py-3',
                'border-amber-400/30 bg-amber-500/[0.08]'
              )}
            >
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
              <p className="text-xs leading-relaxed text-amber-100/80">
                {t('activity.ratting.modals.loot.autoSyncError', {
                  message: lastLootSyncError.message,
                })}
              </p>
            </div>
          )}

          <div
            className={cn(
              'flex gap-3 rounded-lg border px-3 py-3',
              'border-red-400/20 bg-red-500/[0.06]'
            )}
          >
            <Info className={cn('mt-0.5 h-4 w-4 shrink-0', theme.text)} />
            <p className="text-xs leading-relaxed text-red-100/80">
              {t('global.inGameCargoInstructions')}
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-2">
              <label className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                {t('activity.ratting.modals.loot.pasteLabel')}
              </label>
              <Textarea
                value={clipboardText}
                onChange={(e) => setClipboardText(e.target.value)}
                placeholder={t('activity.ratting.modals.loot.pastePlaceholder')}
                className={textareaClass}
              />
              <p className="flex items-center gap-1.5 text-[10px] text-red-300/65">
                <ClipboardCopy className="h-3 w-3 shrink-0" />
                {t('activity.ratting.modals.loot.pasteHint')}
              </p>
            </div>

            <div className={cn('relative flex flex-col overflow-hidden rounded-xl border', theme.panel)}>
              <div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-60', theme.panelWash)} />
              <div className={cn('relative z-[1] px-4 py-3', theme.panelDivider)}>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                    {t('activity.ratting.modals.loot.preview')}
                  </span>
                  <div className="flex items-center gap-2">
                    {isLoading ? (
                      <Loader2 className={cn('h-4 w-4 animate-spin', theme.textMuted)} />
                    ) : previewItems.length > 0 ? (
                      <span className={cn('text-sm font-bold tabular-nums', theme.revenuePositive)}>
                        {formatISK(previewTotal)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={cn(
                  'relative z-[1] grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b px-4 py-2 text-[10px]',
                  'border-red-500/20'
                )}
              >
                <SortHeader column="name" label={t('activity.ratting.modals.loot.colItem')} className="col-span-1" />
                <span className={cn('text-right font-bold uppercase', theme.textMuted)}>
                  {t('activity.ratting.modals.loot.colQty')}
                </span>
                <SortHeader
                  column="unitPrice"
                  label={t('activity.ratting.modals.loot.colUnit')}
                  align="right"
                />
                <SortHeader
                  column="totalValue"
                  label={t('activity.ratting.modals.loot.colTotal')}
                  align="right"
                />
              </div>

              <ScrollArea className="relative z-[1] min-h-[160px] max-h-[220px] flex-1">
                {sortedPreview.length > 0 ? (
                  <ul className="divide-y divide-red-500/10">
                    {sortedPreview.map((item, idx) => (
                      <li
                        key={`${item.name}-${idx}`}
                        className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-red-500/[0.05]"
                      >
                        <span
                          className={cn(
                            'truncate font-medium',
                            item.source === 'jita_buy' ? 'text-red-50' : 'text-red-200/60'
                          )}
                          title={item.source}
                        >
                          {item.name}
                        </span>
                        <span className="text-right tabular-nums text-red-300/60">{item.quantity}</span>
                        <span className="text-right tabular-nums text-red-200/70">
                          {formatISK(item.unitPrice)}
                        </span>
                        <span className={cn('text-right font-semibold tabular-nums', theme.revenuePositive)}>
                          {formatISK(item.totalValue)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="flex min-h-[160px] flex-col items-center justify-center px-4 text-center">
                    <Package className={cn('mb-2 h-8 w-8 opacity-30', theme.textMuted)} />
                    <p className={cn('text-xs', theme.textMuted)}>
                      {isLoading
                        ? t('activity.ratting.modals.loot.previewLoading')
                        : t('activity.ratting.modals.loot.previewEmpty')}
                    </p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>

          {activeTab === 'loot' && (
            <>
              <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
                <div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-60', theme.panelWash)} />
                <div className={cn('relative z-[1] px-4 py-3', theme.panelDivider)}>
                  <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                    {t('activity.ratting.modals.loot.history')}
                    {lootHistoryEntries.length > 0 ? (
                      <span className={cn('ml-2 font-normal', theme.textMuted)}>
                        ({lootHistoryEntries.length})
                      </span>
                    ) : null}
                  </span>
                </div>
                <ScrollArea className="relative z-[1] max-h-[200px]">
                  {renderHistoryList(lootHistoryEntries, 'activity.ratting.modals.loot.historyEmpty', {
                    deletable: true,
                    deleteType: 'loot',
                  })}
                </ScrollArea>
              </div>

              {autoLootHistoryEntries.length > 0 && (
                <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
                  <div className={cn('relative z-[1] px-4 py-3', theme.panelDivider)}>
                    <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
                      {t('activity.ratting.modals.loot.autoHistory')}
                    </span>
                  </div>
                  <ScrollArea className="relative z-[1] max-h-[140px]">
                    {renderHistoryList(autoLootHistoryEntries, 'activity.ratting.modals.loot.historyEmpty', {
                      deletable: false,
                    })}
                  </ScrollArea>
                </div>
              )}
            </>
          )}

          {activeTab === 'mtu' && (
            <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
              <div className={cn('relative z-[1] px-4 py-3', theme.panelDivider)}>
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                  {t('activity.ratting.modals.loot.mtuHistory')}
                </span>
              </div>
              <ScrollArea className="relative z-[1] max-h-[280px]">
                {renderHistoryList(mtuHistoryEntries, 'activity.ratting.modals.loot.mtuHistoryEmpty', {
                  deletable: true,
                  deleteType: 'mtu',
                })}
              </ScrollArea>
            </div>
          )}

          {activeTab === 'salvage' && (
            <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
              <div className={cn('relative z-[1] px-4 py-3', theme.panelDivider)}>
                <span className={cn('text-[10px] font-bold uppercase tracking-wide', theme.text)}>
                  {t('activity.ratting.modals.loot.salvageHistory')}
                </span>
              </div>
              <ScrollArea className="relative z-[1] max-h-[280px]">
                {renderHistoryList(salvageHistoryEntries, 'activity.ratting.modals.loot.salvageHistoryEmpty', {
                  deletable: true,
                  deleteType: 'salvage',
                })}
              </ScrollArea>
            </div>
          )}
        </div>
      </RattingThemedDialog>

      <RattingLootEntryDetailModal
        open={!!selectedEntry}
        onOpenChange={(openState) => !openState && setSelectedEntry(null)}
        entry={selectedEntry}
        activityData={data}
      />
    </>
  )
}
