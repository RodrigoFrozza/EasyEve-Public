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
import { PERFORMANCE_ACTIVITIES, getActivityConfig } from '@/lib/dashboard/performance-config'

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
}

function formatValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
  return value.toFixed(0)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface CustomTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; dataKey: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-700/50 rounded-xl p-3 shadow-2xl min-w-[160px]">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2 font-bold">{label}</div>
      <div className="space-y-1.5">
        {payload.map((entry) => {
          const config = getActivityConfig(entry.dataKey)
          return (
            <div key={entry.name} className="flex items-center gap-3 text-xs">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-zinc-300 font-medium">{config.label}</span>
              <span className="text-zinc-100 font-bold ml-auto font-mono">
                {formatValue(entry.value)}
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
  period,
}: PerformanceChartProps) {
  const chartData = useMemo(() => {
    const activeEntries = Object.values(data).filter((a) => a.dailyData.some((d) => d.value > 0))
    
    const entries = selectedActivities.length > 0
      ? activeEntries.filter(a => selectedActivities.includes(a.activity))
      : activeEntries

    if (entries.length === 0) return []

    const firstEntry = entries[0]
    const allDates = firstEntry.dailyData.map((d) => d.date)

    return allDates.map((date, idx) => {
      const point: Record<string, string | number> = { date }
      for (const entry of entries) {
        point[entry.activity] = entry.dailyData[idx]?.value || 0
      }
      return point
    })
  }, [data, selectedActivities])

  const areas = useMemo(() => {
    const activeEntries = Object.values(data).filter((a) => a.dailyData.some((d) => d.value > 0))
    
    const entries = selectedActivities.length > 0
      ? activeEntries.filter(a => selectedActivities.includes(a.activity))
      : activeEntries

    return entries.map((entry) => ({
      key: entry.activity,
      color: getActivityConfig(entry.activity).color,
    }))
  }, [data, selectedActivities])

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm bg-zinc-900/20 rounded-xl border border-zinc-800/50">
        Sem dados para exibir
      </div>
    )
  }

  const maxValue = Math.max(
    ...chartData.flatMap((d) => areas.map((a) => Number(d[a.key]) || 0))
  )

  return (
    <div className="h-[350px] w-full p-4 bg-zinc-900/10 rounded-2xl border border-zinc-800/30 backdrop-blur-sm">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={chartData}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            {areas.map((area) => (
              <linearGradient
                key={area.key}
                id={`gradient-${area.key}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={area.color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={area.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dy={10}
            fontWeight={500}
          />
          <YAxis
            tickFormatter={formatValue}
            stroke="#52525b"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            dx={-10}
            domain={[0, maxValue * 1.1]}
            width={50}
            fontWeight={500}
          />
          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#3f3f46', strokeWidth: 1 }}
          />
          {areas.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              stroke={area.color}
              strokeWidth={3}
              fill={`url(#gradient-${area.key})`}
              dot={false}
              animationDuration={1000}
              activeDot={{
                r: 5,
                fill: area.color,
                stroke: '#09090b',
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}