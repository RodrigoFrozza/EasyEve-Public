'use client'

import { useMemo, useState } from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

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
  selectedActivity: string | null
  period: number
}

const ACTIVITY_COLORS: Record<string, string> = {
  mining: '#fbbf24',
  ratting: '#f87171',
  abyssal: '#a855f7',
  exploration: '#22d3ee',
  escalations: '#f97316',
  crab: '#84cc16',
  pvp: '#ec4899',
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
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
      <div className="text-xs text-zinc-400 mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 text-sm">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-zinc-300 capitalize">{entry.name}</span>
          <span className="text-zinc-100 font-medium ml-auto">
            {formatValue(entry.value)}
          </span>
        </div>
      ))}
    </div>
  )
}

export function PerformanceChart({
  data,
  selectedActivity,
  period,
}: PerformanceChartProps) {
  const chartData = useMemo(() => {
    const entries = selectedActivity
      ? [data[selectedActivity]]
      : Object.values(data).filter((a) => a.dailyData.some((d) => d.value > 0))

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
  }, [data, selectedActivity])

const areas = useMemo(() => {
    if (!selectedActivity) {
      const colors = Object.keys(ACTIVITY_COLORS)
      const validActs = Object.keys(data).filter(
        (a) => data[a].dailyData.some((d) => d.value > 0)
      )
      return validActs.slice(0, 4).map((act, idx) => ({
        key: act,
        color: ACTIVITY_COLORS[act] || colors[idx % colors.length],
      }))
    }
    return [
      {
        key: selectedActivity,
        color: ACTIVITY_COLORS[selectedActivity] || '#71717a',
      },
    ]
  }, [data, selectedActivity])

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-zinc-500 text-sm">
        Sem dados para exibir
      </div>
    )
  }

  const maxValue = Math.max(
    ...chartData.flatMap((d) => areas.map((a) => Number(d[a.key]) || 0))
  )

  return (
    <div className="h-[300px] w-full">
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
                <stop offset="5%" stopColor={area.color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={area.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#3f3f46"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis
            tickFormatter={formatValue}
            stroke="#71717a"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            dx={-10}
            domain={[0, maxValue * 1.1]}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          {areas.map((area) => (
            <Area
              key={area.key}
              type="monotone"
              dataKey={area.key}
              stroke={area.color}
              strokeWidth={2}
              fill={`url(#gradient-${area.key})`}
              dot={false}
              activeDot={{
                r: 4,
                fill: area.color,
                stroke: '#18181b',
                strokeWidth: 2,
              }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}