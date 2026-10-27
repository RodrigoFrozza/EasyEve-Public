'use client'

import { ArrowUpRight, History } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'

export interface IskHistoryItem {
  id: string
  amount: number
  type: string
  reference: string | null
  createdAt: string
}

interface SubscriptionIskHistoryProps {
  history: IskHistoryItem[]
  formatHistoryType: (type: string) => string
}

export function SubscriptionIskHistory({
  history,
  formatHistoryType,
}: SubscriptionIskHistoryProps) {
  const { t } = useTranslations()

  if (history.length === 0) return null

  return (
    <div className="ta-panel p-[22px]">
      <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-[14px]">
        <History className="h-4 w-4 text-eve-accent" />
        <h3 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">
          {t('subscription.sectionHistory')}
        </h3>
      </div>
      <div className="flex flex-col gap-2">
        {history.slice(0, 5).map((item) => {
          const credit = item.amount > 0
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-[10px] border border-white/[0.05] bg-ta-inset px-3 py-[11px]"
            >
              <div
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[8px]"
                style={{
                  background: credit ? 'rgba(16,185,129,.1)' : 'rgba(244,114,114,.08)',
                  border: `1px solid ${credit ? 'rgba(16,185,129,.2)' : 'rgba(244,114,114,.18)'}`,
                }}
              >
                <ArrowUpRight
                  className={cn('h-4 w-4', credit ? 'text-ta-success' : 'rotate-90 text-ta-danger')}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-accent text-[13px] font-semibold text-ta-bright">
                  {formatHistoryType(item.type)}
                </p>
                <p className="mt-px text-[10.5px] text-ta-muted">
                  <FormattedDate date={item.createdAt} />
                </p>
              </div>
              <p
                className={cn(
                  'font-sans text-[13px] font-bold tabular-nums',
                  credit ? 'text-ta-success' : 'text-ta-danger'
                )}
              >
                {credit ? '+' : '−'}
                {formatISK(Math.abs(item.amount))}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
