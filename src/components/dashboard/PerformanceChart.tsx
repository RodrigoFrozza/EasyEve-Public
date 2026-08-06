'use client'

import { useMemo } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import { getActivityConfig } from '@/lib/dashboard/performance-config'
import {
  buildChartTicks,
  formatPerformanceDate,
  formatPerformanceValue,
} from '@/lib/dashboard/performance-format'
import { useTranslations } from '@/i18n/hooks'

interface DailyData {
  date: string
  value: number
  sessions: number
  durationMinutes: number
}

interface ActivityTrend {
  activity: string
  trend: 'up' | 'down' | 'stable'
  changePercent: number
  currentValue: number
  previousValue: number
  dailyData: DailyData[]
}

interface PerformanceChartProps {
  data: Record<string, ActivityTrend>
  selectedActivities: string[]
  period: number
  emptyLabel?: string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
  locale: string
}

function CustomTooltip({ active, payload, label, locale }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  const displayLabel =
    label && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? formatPerformanceDate(label, locale)
      : label

  return (
    <div className="min-w-[180px] rounded-sm border border-eve-border bg-eve-dark p-3">
      <div className="mb-2 border-b border-eve-border/30 pb-1.5 text-[11px] text-eve-muted">
        {displayLabel}
      </div>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const config = getActivityConfig(entry.dataKey)
          return (
            <div key={entry.name} className="flex items-center gap-2 text-xs">
              <div
                className="h-2 w-2 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate text-eve-muted">{config.label}</span>
              <span className="ml-auto font-medium tabular-nums text-eve-text">
                {formatPerformanceValue(entry.value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PerformanceChart({
  data,
  selectedActivities,
  emptyLabel = 'No data available for this period',
}: PerformanceChartProps) {
  const { locale } = useTranslations()

  const { chartData, areas, maxValue } = useMemo(() => {
    const activeEntries = Object.values(data).filter((a) =>
      a.dailyData.some((d) => d.value > 0)
    )

    const entries =
      selectedActivities.length > 0
        ? activeEntries.filter((a) => selectedActivities.includes(a.activity))
        : activeEntries

    if (entries.length === 0) {
      return { chartData: [], areas: [], maxValue: 0 }
    }

    const firstEntry = entries[0]
    const allDates = firstEntry.dailyData.map((d) => d.date)

    const points = allDates.map((date, idx) => {
      const point: Record<string, string | number> = { date }
      for (const entry of entries) {
        point[entry.activity] = entry.dailyData[idx]?.value || 0
      }
      return point
    })

    const areaList = entries.map((entry) => ({
      key: entry.activity,
      color: getActivityConfig(entry.activity).color,
      label: getActivityConfig(entry.activity).label,
    }))

    const max = Math.max(
      ...points.flatMap((d) => areaList.map((a) => Number(d[a.key]) || 0)),
      0
    )

    return { chartData: points, areas: areaList, maxValue: max }
  }, [data, selectedActivities])

  const yTicks = useMemo(() => buildChartTicks(maxValue * 1.1, 5), [maxValue])
  const yDomainMax = yTicks[yTicks.length - 1] ?? maxValue * 1.1

  if (chartData.length === 0) {
    return (
      <div className="flex h-[min(350px,45vw)] min-h-[260px] items-center justify-center rounded-sm border border-dashed border-eve-border/30 bg-eve-dark text-xs text-eve-muted">
        {emptyLabel}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="relative h-[min(350px,45vw)] min-h-[260px] w-full overflow-hidden rounded-sm bg-eve-dark p-3 sm:p-4">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 8, right: 8, left: 4, bottom: 0 }}
          >
            <defs>
              {areas.map((area) => (
                <linearGradient
                  key={`gradient-${area.key}`}
                  id={`gradient-${area.key}`}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="5%" stopColor={area.color} stopOpacity={0.15} />
                  <stop offset="95%" stopColor={area.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke="#1e3044" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d) => formatPerformanceDate(d, locale)}
              stroke="#1e3044"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              dy={10}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={formatPerformanceValue}
              stroke="#1e3044"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              width={64}
              tickMargin={8}
              ticks={yTicks}
              domain={[0, yDomainMax]}
              allowDecimals={false}
            />
            <Tooltip
              content={<CustomTooltip locale={locale} />}
              cursor={{ stroke: '#1e3044', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {areas.map((area) => (
              <Area
                key={area.key}
                type="monotone"
                dataKey={area.key}
                name={area.label}
                stroke={area.color}
                strokeWidth={1.5}
                fill={`url(#gradient-${area.key})`}
                dot={false}
                activeDot={{
                  r: 3,
                  fill: area.color,
                  stroke: '#0a1119',
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-1">
        {areas.map((area) => (
          <div key={area.key} className="flex items-center gap-2 text-[10px] text-eve-muted">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: area.color }}
              aria-hidden
            />
            <span className="font-medium uppercase tracking-wide">{area.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
