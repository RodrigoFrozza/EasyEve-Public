'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatISK } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { formatNumber } from '@/lib/utils'

interface ExplorationLogDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  log: {
    date?: string
    siteName?: string
    spaceType?: string
    value?: number
    amount?: number
    items?: Array<{
      name?: string
      typeId?: number
      type_id?: number
      id?: number
      quantity?: number
      total?: number
    }>
  } | null
}

export function ExplorationLogDetailsModal({
  open,
  onOpenChange,
  log,
}: ExplorationLogDetailsModalProps) {
  const { t } = useTranslations()
  const [resolvedIds, setResolvedIds] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!log?.items || !open) return

    const itemsToResolve = log.items
      .filter((item) => !item.typeId)
      .map((item) => String(item.name || '').trim())
      .filter(Boolean)

    if (itemsToResolve.length === 0) return

    const resolve = async () => {
      try {
        const res = await fetch('/api/market/appraisal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: itemsToResolve }),
        })
        if (res.ok) {
          const data = await res.json()
          const newResolvedIds: Record<string, number> = {}
          Object.entries(data.appraisal || {}).forEach(([name, info]: [string, unknown]) => {
            const id = (info as { id?: number })?.id
            if (id) newResolvedIds[name.toLowerCase().trim()] = id
          })
          setResolvedIds((prev) => ({ ...prev, ...newResolvedIds }))
        }
      } catch (e) {
        console.error('Failed to resolve type IDs:', e)
      }
    }
    void resolve()
  }, [log, open])

  if (!log) return null

  const unitCount =
    log.items?.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0) || 0
  const estimatedValue = Number(log.value) || Number(log.amount) || 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-black border-zinc-900 shadow-none p-0 overflow-hidden rounded-none">
        <DialogHeader className="p-6 pb-4 border-b border-zinc-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-zinc-500">
              {t('activity.exploration.modals.logDetails.badge')}
            </span>
            <span className="text-[10px] font-mono text-zinc-600 uppercase">
              <FormattedDate date={log.date} mode="datetime" />
            </span>
          </div>
          <DialogTitle className="text-sm font-mono font-bold text-zinc-100 flex items-center gap-2 uppercase tracking-widest">
            <div className="h-2 w-2 bg-zinc-500" />
            {log.siteName}
          </DialogTitle>
          <DialogDescription className="text-zinc-600 font-mono text-[10px] uppercase tracking-widest mt-1">
            {t('activity.exploration.modals.logDetails.sectorType', {
              spaceType: log.spaceType ?? '',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 pt-6 space-y-4 bg-black">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-none">
              <p className="text-[8px] text-zinc-600 uppercase font-mono font-bold mb-1">
                {t('activity.exploration.modals.logDetails.unitCount')}
              </p>
              <span className="text-sm font-mono font-bold text-zinc-100">{unitCount}</span>
            </div>
            <div className="p-3 bg-zinc-950 border border-zinc-900 rounded-none">
              <p className="text-[8px] text-zinc-600 uppercase font-mono font-bold mb-1">
                {t('activity.exploration.modals.logDetails.estimatedValue')}
              </p>
              <span className="text-sm font-mono font-bold text-zinc-100">
                {formatISK(estimatedValue)}
              </span>
            </div>
          </div>

          <div className="rounded-none border border-zinc-900 overflow-hidden bg-black">
            <div className="grid grid-cols-[1fr_80px_100px] gap-2 px-4 py-2 bg-zinc-950 border-b border-zinc-900">
              <span className="text-[8px] font-mono font-bold uppercase text-zinc-600 tracking-widest">
                {t('activity.exploration.modals.logDetails.resourceId')}
              </span>
              <span className="text-[8px] font-mono font-bold uppercase text-zinc-600 tracking-widest text-right">
                {t('activity.exploration.modals.logDetails.quantity')}
              </span>
              <span className="text-[8px] font-mono font-bold uppercase text-zinc-600 tracking-widest text-right">
                {t('activity.exploration.modals.logDetails.valueEst')}
              </span>
            </div>
            <ScrollArea className="h-[300px]">
              <div className="divide-y divide-zinc-900">
                {log.items?.map((item) => {
                  const itemKey = `${item.typeId ?? item.name ?? 'item'}-${item.quantity ?? 0}`
                  const typeId =
                    item.typeId ||
                    item.type_id ||
                    item.id ||
                    resolvedIds[String(item.name || '').toLowerCase().trim()]
                  return (
                    <div
                      key={itemKey}
                      className="grid grid-cols-[1fr_80px_100px] gap-2 px-4 py-2 hover:bg-zinc-950 transition-none items-center"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 shrink-0 rounded-none bg-black flex items-center justify-center border border-zinc-900">
                          <Image
                            src={`https://images.evetech.net/types/${typeId || 0}/icon?size=32`}
                            alt={String(item.name || '')}
                            width={24}
                            height={24}
                            className="grayscale opacity-50 contrast-125 transition-none"
                            unoptimized
                          />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-zinc-400 truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 text-right">
                        {formatNumber(Number(item.quantity) || 0)}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-100 text-right font-bold">
                        {formatISK(Number(item.total) || 0)}
                      </span>
                    </div>
                  )
                })}
                {(!log.items || log.items.length === 0) && (
                  <div className="py-10 text-center">
                    <p className="text-[10px] text-zinc-700 font-mono font-bold uppercase">
                      {t('activity.exploration.modals.logDetails.noItems')}
                    </p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <div className="p-4 bg-black border-t border-zinc-900 flex">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full h-8 border border-zinc-800 bg-black hover:bg-zinc-900 text-[10px] font-mono font-bold uppercase text-zinc-600 hover:text-zinc-100 transition-none tracking-widest rounded-none"
          >
            {t('activity.exploration.modals.logDetails.close')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
