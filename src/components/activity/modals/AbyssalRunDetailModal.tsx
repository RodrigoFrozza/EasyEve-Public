'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatISK, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import Image from 'next/image'
import { ABYSSAL_TIERS, ABYSSAL_WEATHER } from '@/lib/constants/activity-data'
import { useTranslations } from '@/i18n/hooks'

interface Item {
  name: string
  quantity: number
  value?: number
}

interface AbyssalRunDetailModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  run: {
    id: string
    startTime: string
    endTime?: string
    tier?: string
    weather?: string
    ship?: string
    lootValue?: number
    registrationStatus?: string
    lootItems?: Item[]
    consumedItems?: Item[]
  } | null
  onRegisterLoot?: (runId: string) => void
}

export function AbyssalRunDetailModal({
  open,
  onOpenChange,
  run,
  onRegisterLoot,
}: AbyssalRunDetailModalProps) {
  const { t } = useTranslations()
  const tierIcon = run ? ABYSSAL_TIERS.find((tier) => tier.label === run.tier)?.iconPath : undefined
  const weatherIcon = run
    ? ABYSSAL_WEATHER.find((weather) => weather.label === run.weather)?.iconPath
    : undefined
  const netProfit = run?.lootValue || 0
  const isPending = run?.registrationStatus === 'pending'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden rounded-sm border-eve-border bg-eve-dark p-0 text-white">
        <DialogHeader className="border-b border-eve-border/30 p-6 pb-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                {tierIcon && (
                  <div className="relative h-8 w-8 rounded-sm border border-eve-border/30 bg-eve-panel p-1">
                    <Image src={tierIcon} alt={t('activity.abyssal.tier')} fill className="object-contain opacity-80" />
                  </div>
                )}
                {weatherIcon && (
                  <div className="relative h-8 w-8 rounded-sm border border-eve-border/30 bg-eve-panel p-1">
                    <Image
                      src={weatherIcon}
                      alt={t('activity.abyssal.weather')}
                      fill
                      className="object-contain opacity-80"
                    />
                  </div>
                )}
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold text-eve-text">
                  {t('activity.abyssal.runDetailTitle')}
                </DialogTitle>
                <DialogDescription className="text-[11px] text-eve-muted">
                  {run ? (
                    <FormattedDate date={run.startTime} mode="datetime" />
                  ) : (
                    t('activity.abyssal.runDetailEmpty')
                  )}
                </DialogDescription>
              </div>
            </div>
            {run && (
              <div className="text-right">
                <p className="text-[11px] text-eve-muted">{t('activity.abyssal.netProfit')}</p>
                <p
                  className={cn(
                    'text-lg font-bold tabular-nums',
                    netProfit >= 0 ? 'text-eve-text' : 'text-eve-muted'
                  )}
                >
                  {formatISK(netProfit)}
                </p>
              </div>
            )}
          </div>
        </DialogHeader>

        {run ? (
          <div className="space-y-6 bg-eve-dark p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-[11px] font-medium text-eve-muted">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {t('activity.abyssal.gainedItems')}
                </h4>
                <ScrollArea className="h-[250px] rounded-sm border border-eve-border/30 bg-eve-panel p-3">
                  <div className="space-y-1.5">
                    {run.lootItems && run.lootItems.length > 0 ? (
                      run.lootItems.map((item) => (
                        <div
                          key={`${item.name}-${item.quantity}`}
                          className="flex items-center justify-between border-b border-eve-border/20 pb-1 text-xs"
                        >
                          <span className="max-w-[150px] truncate text-eve-muted">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="tabular-nums text-eve-text">{formatISK(item.value || 0)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-xs text-eve-muted">
                        {t('activity.abyssal.noLootItems')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <h4 className="flex items-center gap-2 text-[11px] font-medium text-eve-muted">
                  <div className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  {t('activity.abyssal.usedItems')}
                </h4>
                <ScrollArea className="h-[250px] rounded-sm border border-eve-border/30 bg-eve-panel p-3">
                  <div className="space-y-1.5">
                    {run.consumedItems && run.consumedItems.length > 0 ? (
                      run.consumedItems.map((item) => (
                        <div
                          key={`${item.name}-${item.quantity}`}
                          className="flex items-center justify-between border-b border-eve-border/20 pb-1 text-xs"
                        >
                          <span className="max-w-[150px] truncate text-eve-muted">
                            {item.name} x{item.quantity}
                          </span>
                          <span className="text-eve-muted/60">-{formatISK(item.value || 0)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="py-4 text-center text-xs text-eve-muted">
                        {t('activity.abyssal.noConsumedItems')}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>

            <div className="rounded-sm border border-eve-border/30 bg-eve-panel p-3">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="mb-0.5 text-[10px] text-eve-muted">{t('activity.abyssal.ship')}</p>
                  <p className="text-xs text-eve-text">{run.ship || t('common.notAvailable')}</p>
                </div>
                <div className="border-l border-eve-border/30 pl-4">
                  <p className="mb-0.5 text-[10px] text-eve-muted">{t('activity.abyssal.tier')}</p>
                  <p className="text-xs text-eve-text">{run.tier || t('common.notAvailable')}</p>
                </div>
                <div className="border-l border-eve-border/30 pl-4">
                  <p className="mb-0.5 text-[10px] text-eve-muted">{t('activity.abyssal.weather')}</p>
                  <p className="text-xs text-eve-text">{run.weather || t('common.notAvailable')}</p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-eve-dark p-6 text-sm text-eve-muted">{t('activity.abyssal.runDetailEmpty')}</div>
        )}

        <DialogFooter className="flex gap-2 border-t border-eve-border/30 bg-eve-dark p-4">
          {run && isPending && onRegisterLoot && (
            <Button
              type="button"
              onClick={() => onRegisterLoot(run.id)}
              className="h-9 flex-1 rounded-sm text-xs"
            >
              {t('activity.abyssal.registerRun')}
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className={cn('h-9 rounded-sm text-xs', run && isPending ? 'flex-1' : 'w-full')}
          >
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
