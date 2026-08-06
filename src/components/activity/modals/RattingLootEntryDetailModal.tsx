'use client'

import { Button } from '@/components/ui/button'
import { formatISK, cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import Image from 'next/image'
import { useTranslations } from '@/i18n/hooks'
import { RattingThemedDialog, rattingModalTheme } from './ratting/RattingThemedDialog'
import { FormattedDate } from '@/components/shared/FormattedDate'
import {
  resolveRattingEntryItems,
  type RattingActivityData,
  type RattingLogEntry,
} from '@/lib/activities/ratting-manual-entries'

/**
 * MTU/salvage entries recorded before the unitPrice/totalValue shape was
 * standardized only carry a combined `value` field. Read-only fallback,
 * legacy records are not migrated.
 */
function resolveItemPricing(item: {
  quantity?: unknown
  value?: unknown
  unitPrice?: unknown
  totalValue?: unknown
}): { unitPrice: number; totalValue: number } {
  const quantity = Number(item.quantity) || 0
  const legacyValue = Number(item.value) || 0
  const unitPrice =
    item.unitPrice != null ? Number(item.unitPrice) || 0 : quantity > 0 ? legacyValue / quantity : 0
  const totalValue = item.totalValue != null ? Number(item.totalValue) || 0 : legacyValue
  return { unitPrice, totalValue }
}

interface RattingLootEntryDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  entry: Record<string, unknown> | null
  activityData?: RattingActivityData
}

export function RattingLootEntryDetailModal({
  open,
  onOpenChange,
  entry,
  activityData,
}: RattingLootEntryDetailModalProps) {
  const { t } = useTranslations()
  const theme = rattingModalTheme

  if (!entry) return null

  const resolvedItems =
    activityData != null
      ? resolveRattingEntryItems(activityData, entry as unknown as RattingLogEntry)
      : []
  const items =
    resolvedItems.length > 0
      ? resolvedItems
      : ((entry.items as Array<Record<string, unknown>>) || [])
  const amount = Number(entry.amount) || 0

  return (
    <RattingThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.ratting.modals.loot.detailBadge')}
      title={t('activity.ratting.modals.loot.detailTitle')}
      description={t('activity.ratting.modals.loot.detailDescription', {
        pilot: String(entry.charName || t('activity.ratting.modals.loot.unknownPilot')),
        value: formatISK(amount),
      })}
      maxWidth="2xl"
      scrollable
      footer={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className={cn(
            'h-10 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide',
            theme.chip
          )}
        >
          {t('activity.ratting.modals.common.close')}
        </Button>
      }
    >
      <p className={cn('mb-4 text-xs', theme.textMuted)}>
        <FormattedDate date={String(entry.date)} mode="datetime" />
      </p>

      <div className={cn('relative overflow-hidden rounded-xl border', theme.panel)}>
        <div aria-hidden className={cn('pointer-events-none absolute inset-0 opacity-60', theme.panelWash)} />
        <div
          className={cn(
            'relative z-[1] grid grid-cols-[1fr_auto_auto_auto] gap-2 border-b px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide',
            'border-red-500/25',
            theme.textMuted
          )}
        >
          <span>{t('activity.ratting.modals.loot.colItem')}</span>
          <span className="text-right">{t('activity.ratting.modals.loot.colQty')}</span>
          <span className="text-right">{t('activity.ratting.modals.loot.colUnit')}</span>
          <span className="text-right">{t('activity.ratting.modals.loot.colTotal')}</span>
        </div>
        <ScrollArea className="relative z-[1] max-h-[min(360px,50vh)]">
          {items.length > 0 ? (
            <ul className="divide-y divide-red-500/10">
              {items.map((item, idx) => {
                const { unitPrice, totalValue } = resolveItemPricing(item)
                return (
                  <li
                    key={`${String(item.name)}-${item.quantity}-${idx}`}
                    className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2 px-4 py-2.5 text-xs hover:bg-red-500/[0.04]"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div
                        className={cn(
                          'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border',
                          theme.historyIconBox
                        )}
                      >
                        <Image
                          src={`https://images.evetech.net/types/${Number(item.typeId) || 0}/icon?size=32`}
                          alt={String(item.name || 'Item')}
                          width={24}
                          height={24}
                          className="h-6 w-6 opacity-90"
                          unoptimized
                        />
                      </div>
                      <span className="truncate font-medium text-red-50">{String(item.name)}</span>
                    </div>
                    <span className="text-right tabular-nums text-red-300/60">
                      {Number(item.quantity)}
                    </span>
                    <span className="text-right tabular-nums text-red-200/70">
                      {formatISK(unitPrice)}
                    </span>
                    <span className={cn('text-right font-semibold tabular-nums', theme.revenuePositive)}>
                      {formatISK(totalValue)}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div
              className={cn(
                'flex min-h-[200px] items-center justify-center px-4 text-center text-xs',
                theme.textMuted
              )}
            >
              {t('activity.ratting.modals.loot.detailEmpty')}
            </div>
          )}
        </ScrollArea>
      </div>
    </RattingThemedDialog>
  )
}
