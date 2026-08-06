'use client'

import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { CompositionSlice } from '@/lib/activity/activity-analytics'
import {
  analyticsCompositionTrack,
  analyticsPanelSurface,
} from '@/lib/activity/activity-analytics-surface'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  theme: ActivityThemeClasses
  titleKey?: string
  slices: CompositionSlice[]
  labelNamespace?: string
  grossTotal?: number
  netTotal?: number
}

function resolveSliceLabel(
  slice: CompositionSlice,
  t: (key: string) => string,
  labelNamespace: string
): string {
  if (slice.labelKey) {
    return t(`${labelNamespace}.${slice.labelKey}`)
  }
  return slice.label
}

export function ActivityAnalyticsComposition({
  theme,
  titleKey = 'composition',
  slices,
  labelNamespace = 'activity.ratting.analytics',
  grossTotal,
  netTotal,
}: Props) {
  const { t } = useTranslations()

  const incomeSlices = slices.filter((s) => s.kind !== 'deduction')
  const deductionSlices = slices.filter((s) => s.kind === 'deduction')
  const computedGross = grossTotal ?? incomeSlices.reduce((sum, s) => sum + s.value, 0)
  const computedNet =
    netTotal ?? computedGross - deductionSlices.reduce((sum, s) => sum + s.value, 0)

  if (slices.length === 0) {
    return (
      <div className={analyticsPanelSurface(theme)}>
        <p className={cn('font-mono text-[10px] font-bold uppercase', theme.textMuted)}>
          {t(`activity.analytics.${titleKey}`)}
        </p>
        <p className="mt-4 text-center font-mono text-[10px] text-zinc-500">
          {t('activity.analytics.emptyComposition')}
        </p>
      </div>
    )
  }

  const renderSlice = (slice: CompositionSlice) => {
    const isDeduction = slice.kind === 'deduction'
    return (
      <div key={`${slice.label}-${slice.kind ?? 'income'}`}>
        <div className="mb-1.5 flex justify-between gap-2 font-mono text-[11px]">
          <span className={cn('truncate font-bold uppercase tracking-wide', theme.text)}>
            {resolveSliceLabel(slice, t, labelNamespace)}
          </span>
          <span
            className={cn(
              'shrink-0 tabular-nums font-semibold',
              isDeduction ? 'text-rose-300' : theme.text
            )}
          >
            {isDeduction ? `−${slice.pct.toFixed(1)}` : `${slice.pct.toFixed(1)}`}%
          </span>
        </div>
        <div className={analyticsCompositionTrack()}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(100, slice.pct)}%`, backgroundColor: slice.color }}
          />
        </div>
        <p
          className={cn(
            'mt-1 text-right font-mono text-[10px] tabular-nums font-semibold',
            isDeduction ? 'text-rose-300' : theme.textMuted
          )}
        >
          {isDeduction ? '−' : ''}
          {formatCurrencyValue(slice.value)}
        </p>
      </div>
    )
  }

  return (
    <div className={analyticsPanelSurface(theme)}>
      <div className="mb-4 flex items-start justify-between gap-3 border-b border-white/12 pb-3">
        <p className={cn('font-mono text-[10px] font-bold uppercase tracking-wider', theme.text)}>
          {t(`activity.analytics.${titleKey}`)}
        </p>
        <div className="text-right">
          <p className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.analytics.grossIncome')}
          </p>
          <p className={cn('font-mono text-sm font-bold tabular-nums', theme.text)}>
            {formatCurrencyValue(computedGross)}
          </p>
        </div>
      </div>

      <div className="space-y-3.5">{incomeSlices.map(renderSlice)}</div>

      {deductionSlices.length > 0 && (
        <div className="mt-5 space-y-3.5 border-t border-rose-500/20 pt-4">
          <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300/90">
            {t('activity.analytics.deductions')}
          </p>
          {deductionSlices.map(renderSlice)}
        </div>
      )}

      {deductionSlices.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-white/12 bg-zinc-950/35 px-3 py-2.5">
          <span className={cn('font-mono text-[9px] font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.analytics.kpi.totalNet')}
          </span>
          <span className={cn('font-mono text-sm font-bold tabular-nums text-white')}>
            {formatCurrencyValue(computedNet)}
          </span>
        </div>
      )}
    </div>
  )
}
