'use client'
import { Card, CardContent } from "@/components/ui/card"
import { Users, Zap, Wallet, Fingerprint, TrendingUp, TrendingDown } from "lucide-react"
import { formatISK, cn } from "@/lib/utils"

import { useTranslations } from "@/i18n/hooks"

interface StatsRowProps {
  totalAccounts: number
  activeSubscriptions: number
  pendingIsk: number
  totalCharacters: number
  historicalData?: {
    accounts: number[]
    subscriptions: number[]
    characters: number[]
  }
}

function generateSparklineData(baseValue: number, data?: number[]): number[] {
  if (!data || data.length < 2) {
    const now = Date.now()
    return Array.from({ length: 7 }, (_, i) => {
      const variation = Math.sin(now / 10000000 + i * 2) * 0.1
      return Math.max(0, baseValue * (0.85 + variation + Math.random() * 0.1))
    })
  }
  return data.slice(-7).map(x => x || 0)
}

function calculateTrend(current: number, data?: number[]): number | null {
  if (!data || data.length < 2) return null
  const validData = data.filter(x => typeof x === 'number')
  if (validData.length < 2) return null
  const avg = validData.slice(0, Math.min(7, validData.length - 1)).reduce((a, b) => a + b, 0) / Math.min(7, validData.length - 1)
  if (avg === 0) return null
  return Math.round(((current - avg) / avg) * 100)
}

export function StatsRow({ totalAccounts, activeSubscriptions, pendingIsk, totalCharacters, historicalData }: StatsRowProps) {
  const { t } = useTranslations()
  
  const accountsTrend = calculateTrend(totalAccounts, historicalData?.accounts)
  const subscriptionsTrend = calculateTrend(activeSubscriptions, historicalData?.subscriptions)
  const charactersTrend = calculateTrend(totalCharacters, historicalData?.characters)
  
  const pendingTrend = pendingIsk > 0 ? Math.round((pendingIsk / Math.max(1, totalAccounts * 1000000)) * 10) : 0
  
  const stats = [
    {
      label: t('admin.manageAccounts'),
      value: totalAccounts,
      icon: Users,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      description: t('admin.manageAccounts'),
      trend: accountsTrend,
      trendData: generateSparklineData(totalAccounts, historicalData?.accounts)
    },
    {
      label: t('admin.filterActive'),
      value: activeSubscriptions,
      icon: Zap,
      color: "text-green-400",
      bg: "bg-green-500/10",
      description: t('account.validSubscription'),
      trend: subscriptionsTrend,
      trendData: generateSparklineData(activeSubscriptions, historicalData?.subscriptions)
    },
    {
      label: t('admin.value'),
      value: formatISK(pendingIsk),
      icon: Wallet,
      color: pendingIsk > 50000000 ? "text-red-400" : "text-yellow-400",
      bg: "bg-yellow-500/10",
      description: t('admin.noPaymentRecords'),
      trend: pendingTrend,
      sparklineColor: pendingIsk > 50000000 ? "text-red-400" : "text-yellow-400",
      trendData: generateSparklineData(pendingIsk / 1000000, undefined)
    },
    {
      label: t('admin.characters'),
      value: totalCharacters,
      icon: Fingerprint,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      description: t('admin.integratedCharacters'),
      trend: charactersTrend,
      trendData: generateSparklineData(totalCharacters, historicalData?.characters)
    }
  ]


return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => {
        const trendPositive = stat.trend !== null && stat.trend >= 0
        const trendColor = stat.trend === null ? "text-gray-500" : trendPositive ? "text-green-400" : "text-red-400"
        const TrendIcon = trendPositive ? TrendingUp : TrendingDown
        
        // Generate sparkline path
        const sparklineData = stat.trendData || []
        const maxVal = Math.max(...sparklineData, 1)
        const minVal = Math.min(...sparklineData, 1)
        const range = maxVal - minVal || 1
        const pathData = sparklineData.length > 0 
          ? sparklineData.map((v, idx) => {
              const x = (idx / 6) * 100
              const y = 38 - ((v - minVal) / range) * 32
              return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`
            }).join(" ")
          : `M 0 20 Q 25 10, 50 20 T 100 15`
        
        return (
        <Card 
          key={i} 
          className="bg-eve-panel/60 backdrop-blur-sm border-eve-border/30 overflow-hidden relative group hover:border-eve-accent/20 transition-colors duration-300"
          title={stat.description}
        >
          <CardContent className="p-5 relative z-10">
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-lg ${stat.bg} border border-white/5`}>
                {(() => {
                  const Icon = stat.icon
                  return Icon ? <Icon className={`h-5 w-5 ${stat.color}`} /> : null
                })()}
              </div>
              <div className="flex flex-col items-end">
                <p className="text-[10px] text-gray-500 uppercase font-black tracking-[0.2em]">{stat.label}</p>
                <div className="flex items-baseline gap-1">
                   <p className="text-2xl font-bold text-white tracking-tight">{stat.value}</p>
                   {stat.trend !== null && (
                     <span className={cn("text-[10px] font-bold flex items-center gap-0.5", trendColor)}>
                        <TrendIcon className="h-3 w-3" />
                        {stat.trend > 0 ? "+" : ""}{stat.trend}%
                     </span>
                   )}
                </div>
              </div>
            </div>

            {/* Sparkline SVG - reduced opacity */}
            <div className="h-8 w-full opacity-30 group-hover:opacity-50 transition-opacity">
              <svg viewBox="0 0 100 40" className="w-full h-full overflow-visible">
                <defs>
                  <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="currentColor" className={stat.color} stopOpacity="0.2" />
                    <stop offset="100%" stopColor="currentColor" className={stat.color} stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d={pathData}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className={stat.color}
                  strokeLinecap="round"
                />
                <path
                  d={`${pathData} L 100 40 L 0 40 Z`}
                  fill={`url(#grad-${i})`}
                  className={stat.color}
                />
              </svg>
            </div>
          </CardContent>
        </Card>
      )})}
    </div>
  )
}
