'use client'

import React from 'react'
import { ShipStats } from '@/types/fit'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { Cpu, Zap, Battery } from 'lucide-react'
import { FormattedNumber } from '../shared/FormattedNumber'

interface FitStatsSnapshotProps {
  stats: ShipStats | null | undefined
  className?: string
}

export const FitStatsSnapshot: React.FC<FitStatsSnapshotProps> = ({ stats, className }) => {
  if (!stats) return null

  const getStatusColor = (percent: number) => {
    if (percent > 100) return 'text-red-500 bg-red-500'
    if (percent > 90) return 'text-yellow-500 bg-yellow-500'
    return 'text-blue-400 bg-blue-500'
  }

  const StatBar = ({ 
    label, 
    value, 
    total, 
    percent, 
    icon: Icon,
    unit = ''
  }: { 
    label: string, 
    value: number, 
    total: number, 
    percent: number, 
    icon: any,
    unit?: string
  }) => (
    <div className="space-y-1.5">
      <div className="flex justify-between items-end text-xs font-medium">
        <div className="flex items-center gap-1.5 text-zinc-400 uppercase tracking-wider">
          <Icon className="w-3.5 h-3.5" />
          {label}
        </div>
        <div className={cn("font-mono", percent > 100 ? "text-red-400" : "text-zinc-200")}>
          <FormattedNumber value={value} options={{ maximumFractionDigits: 1 }} suffix={unit} /> / <FormattedNumber value={total} suffix={unit} />
        </div>
      </div>
      <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
        <motion.div 
          className={cn("h-full rounded-full transition-all duration-500", getStatusColor(percent).split(' ')[1])}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(percent, 100)}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ opacity: percent > 100 ? 1 : 0.8 }}
        />
      </div>
    </div>
  )

  return (
    <div className={cn("p-4 bg-zinc-900/40 backdrop-blur-md rounded-xl border border-white/5 space-y-4", className)}>
      <StatBar 
        label="CPU" 
        value={stats.cpu.used} 
        total={stats.cpu.total} 
        percent={stats.cpu.percent}
        icon={Cpu}
        unit=" tf"
      />
      <StatBar 
        label="Powergrid" 
        value={stats.powergrid.used} 
        total={stats.powergrid.total} 
        percent={stats.powergrid.percent}
        icon={Zap}
        unit=" MW"
      />
      <StatBar 
        label="Capacitor (Delta)" 
        value={stats.capacitor.peakDelta} 
        total={stats.capacitor.capacity} 
        percent={stats.capacitor.peakDelta > 0 ? 100 : 0} // Placeholder for cap status
        icon={Battery}
        unit=" GJ/s"
      />
    </div>
  )
}
