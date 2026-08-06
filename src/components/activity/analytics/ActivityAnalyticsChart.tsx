'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'
import type { SparklineDataset, TimelinePoint } from '@/lib/activity/activity-analytics'
import { Sparkline } from '@/components/ui/Sparkline'
import {
  analyticsChartWell,
  analyticsPanelSurface,
} from '@/lib/activity/activity-analytics-surface'
import { formatCurrencyValue, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'

type Props = {
  theme: ActivityThemeClasses
  titleKey?: string
  points: TimelinePoint[]
  datasets: SparklineDataset[]
  emphasizeLabel?: string
}

export function ActivityAnalyticsChart({
  theme,
  titleKey = 'cumulativeTimeline',
  points,
  datasets,
  emphasizeLabel,
}: Props) {
  const { t } = useTranslations()
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(400)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(Math.floor(w))
    })
    ro.observe(el)
    setWidth(Math.floor(el.clientWidth) || 400)
    return () => ro.disconnect()
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (points.length < 2) return
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const idx = Math.round((x / rect.width) * (points.length - 1))
      setHoveredIndex(Math.max(0, Math.min(points.length - 1, idx)))
    },
    [points.length]
  )

  const hasChart = datasets.some((d) => d.data.length >= 2)
  const hovered = hoveredIndex != null ? points[hoveredIndex] : null

  return (
    <div className={analyticsPanelSurface(theme)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/12 pb-2">
        <p className={cn('font-mono text-[10px] font-bold uppercase tracking-wide', theme.text)}>
          {t(`activity.analytics.${titleKey}`)}
        </p>
        {hovered && (
          <p className={cn('font-mono text-[11px] font-semibold tabular-nums', theme.text)}>
            {hovered.formattedTime} · {formatCurrencyValue(hovered.cumulative)} ·{' '}
            {formatCurrencyValue(hovered.iskPerHour)}/h
          </p>
        )}
      </div>

      {datasets.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2">
          {datasets.map((ds) => {
            const emphasized = emphasizeLabel === ds.label
            return (
              <div key={ds.label} className="flex items-center gap-2">
                <div
                  className={cn('rounded-full', emphasized ? 'h-2.5 w-2.5' : 'h-2 w-2')}
                  style={{ backgroundColor: ds.color }}
                />
                <span
                  className={cn(
                    'font-mono uppercase tracking-wide',
                    emphasized
                      ? cn('text-[10px] font-bold', theme.text)
                      : cn('text-[9px] font-semibold', theme.textMuted)
                  )}
                >
                  {ds.label}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div
        ref={containerRef}
        className={analyticsChartWell()}
        style={{ minHeight: 140 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredIndex(null)}
      >
        {hasChart ? (
          <Sparkline datasets={datasets} width={width} height={128} strokeWidth={1.75} className="px-2 py-2" />
        ) : (
          <div className="flex h-[120px] flex-col items-center justify-center gap-1 px-4 text-center">
            <p className={cn('font-mono text-[10px] font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.analytics.emptyChart')}
            </p>
            <p className="font-mono text-[9px] text-zinc-600">{t('activity.analytics.emptyChartHint')}</p>
          </div>
        )}
      </div>
    </div>
  )
}
