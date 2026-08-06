'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { ScrollArea } from '@/components/ui/scroll-area'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

export type BreakdownRow = {
  id: string
  primary: string
  secondary?: string
  value: string
  subValue?: string
}

type Props = {
  theme: ActivityThemeClasses
  titleKey: string
  rows: BreakdownRow[]
  maxHeight?: string
}

export function ActivityAnalyticsBreakdownList({
  theme,
  titleKey,
  rows,
  maxHeight = 'h-[200px]',
}: Props) {
  const { t } = useTranslations()

  return (
    <div className={cn('overflow-hidden rounded-xl border backdrop-blur-md', theme.panel)}>
      <div className={cn('border-b px-4 py-2.5', theme.panelDivider)}>
        <p className={cn('font-mono text-[10px] font-bold uppercase tracking-wide', theme.text)}>
          {t(`activity.analytics.${titleKey}`)}
        </p>
      </div>
      <ScrollArea className={maxHeight}>
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center font-mono text-[10px] text-zinc-600">
            {t('activity.analytics.emptyList')}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {rows.map((row) => (
              <div
                key={row.id}
                className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.03]"
              >
                <div className="min-w-0 flex-1">
                  <p className={cn('truncate font-mono text-[10px] font-bold uppercase', theme.text)}>
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="mt-0.5 font-mono text-[9px] text-zinc-600">{row.secondary}</p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={cn('font-mono text-[10px] font-bold tabular-nums', theme.text)}>
                    {row.value}
                  </p>
                  {row.subValue && (
                    <p className="mt-0.5 font-mono text-[9px] text-zinc-500">{row.subValue}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
