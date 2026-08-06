'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import { analyticsMetricTile } from '@/lib/activity/activity-analytics-surface'
import { formatCompactNumber, formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type KpiTone = 'default' | 'positive' | 'negative' | 'accent'

type KpiItem = {
  labelKey: string
  value: number
  format: 'isk' | 'number' | 'volume' | 'text'
  textValue?: string
  tone?: KpiTone
}

type Props = {
  theme: ActivityThemeClasses
  items: KpiItem[]
  columns?: 2 | 3 | 4 | 6
}

const toneValueClass: Record<KpiTone, string> = {
  default: '',
  positive: 'text-emerald-300',
  negative: 'text-rose-300',
  accent: 'text-white',
}

export function getKpiGridClass(columns: 2 | 3 | 4 | 6): string {
  if (columns === 6) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
  if (columns === 3) return 'grid-cols-2 sm:grid-cols-3'
  if (columns === 2) return 'grid-cols-2'
  return 'grid-cols-2 sm:grid-cols-4'
}

export function ActivityAnalyticsKpiRow({ theme, items, columns = 4 }: Props) {
  const { t } = useTranslations()

  const gridClass = getKpiGridClass(columns)

  const formatValue = (item: KpiItem) => {
    if (item.format === 'text' && item.textValue) return item.textValue
    if (item.format === 'isk') {
      const formatted = formatCurrencyValue(item.value)
      return item.tone === 'negative' && item.value > 0 ? `-${formatted}` : formatted
    }
    if (item.format === 'volume') return `${formatCompactNumber(Math.round(item.value))} m³`
    return formatCompactNumber(item.value)
  }

  return (
    <div className={cn('grid gap-2', gridClass)}>
      {items.map((item) => {
        const tone = item.tone ?? 'default'
        return (
          <div key={item.labelKey} className={analyticsMetricTile(theme)}>
            <p
              className={cn(
                'mb-1.5 font-mono text-[10px] font-bold uppercase tracking-wider',
                theme.textMuted
              )}
            >
              {t(`activity.analytics.kpi.${item.labelKey}`)}
            </p>
            <p
              className={cn(
                'font-mono text-base font-bold tabular-nums tracking-tight sm:text-lg',
                tone === 'default' ? theme.text : toneValueClass[tone]
              )}
            >
              {formatValue(item)}
            </p>
          </div>
        )
      })}
    </div>
  )
}
