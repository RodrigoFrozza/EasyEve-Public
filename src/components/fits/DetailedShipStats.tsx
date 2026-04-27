'use client'

import React from 'react'
import { ShipStats } from '@/types/fit'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { FormattedNumber } from '../shared/FormattedNumber'
import { 
  Shield, 
  Zap, 
  Target, 
  Wind, 
  Activity,
  Cpu,
  ChevronRight,
  ShieldAlert,
  Layers,
  Crosshair
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import { ModifierBreakdown } from './ModifierBreakdown'

interface DetailedShipStatsProps {
  stats: ShipStats | null | undefined
  className?: string
}

const StatRow = React.memo(({ label, value, unit = '', color = 'text-zinc-100', subValue, historyKey, history }: { label: string, value: string | number, unit?: string, color?: string, subValue?: string, historyKey?: string, history?: any }) => {
  const content = (
    <div className="flex justify-between items-center py-1 group/row border-b border-white/[0.02] cursor-help">
      <div className="flex flex-col">
        <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-tight group-hover/row:text-zinc-400 transition-colors">{label}</span>
        {subValue && <span className="text-[8px] text-zinc-700 font-mono -mt-0.5">{subValue}</span>}
      </div>
      <div className="flex gap-1 items-baseline">
        <span className={cn("text-[11px] font-mono font-bold tabular-nums", color)}>
          {typeof value === 'number' ? (
            <FormattedNumber value={value} options={{ maximumFractionDigits: (value < 10 ? 2 : 1) }} />
          ) : value}
        </span>
        <span className="text-[8px] text-zinc-600 font-mono uppercase">{unit}</span>
      </div>
    </div>
  )

  if (historyKey && history?.[historyKey]) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent 
            side="left" 
            className="p-0 border-none bg-transparent shadow-none"
            sideOffset={10}
          >
            <ModifierBreakdown 
              history={history} 
              historyKey={historyKey} 
            />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return content
})

StatRow.displayName = 'StatRow'

const Section = React.memo(({ title, icon: Icon, children, accentColor = "text-blue-400" }: { title: string, icon: any, children: React.ReactNode, accentColor?: string }) => (
  <div className="group/section bg-zinc-900/40 rounded-xl border border-white/5 overflow-hidden transition-all hover:bg-zinc-900/60 hover:border-white/10">
    <div className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] border-b border-white/5">
      <Icon className={cn("w-3.5 h-3.5", accentColor)} />
      <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{title}</h4>
      <div className="ml-auto h-px flex-1 bg-gradient-to-r from-white/5 to-transparent mx-2" />
    </div>
    <div className="p-3 pt-2 space-y-0.5">
      {children}
    </div>
  </div>
))

Section.displayName = 'Section'

const ResistGrid = React.memo(({ label, resists, hp, iconColor, type: layerType, history }: { label: string, resists: { em: number, therm: number, kin: number, exp: number }, hp: number, iconColor: string, type: 'Shield' | 'Armor' | 'Hull', history?: any }) => (
  <div className="space-y-1.5 pt-1">
    <div className="flex justify-between items-end mb-1">
      <span className={cn("text-[9px] font-black uppercase font-mono", iconColor)}>{label}</span>
      <span className="text-[11px] font-mono font-bold text-white tabular-nums"><FormattedNumber value={hp} suffix=" HP" /></span>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
      {[
        { type: 'EM', label: `${layerType} EM Resist`, val: resists.em, bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400' },
        { type: 'TH', label: `${layerType} Thermal Resist`, val: resists.therm, bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-400' },
        { type: 'KI', label: `${layerType} Kinetic Resist`, val: resists.kin, bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', text: 'text-yellow-400' },
        { type: 'EX', label: `${layerType} Explosive Resist`, val: resists.exp, bg: 'bg-green-500/10', border: 'border-green-500/20', text: 'text-green-400' }
      ].map(r => (
        <TooltipProvider key={r.type}>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div className={cn("flex flex-col items-center py-1.5 rounded-lg border cursor-help transition-all hover:border-white/20 hover:bg-white/[0.03]", r.bg, r.border)}>
                <span className={cn("text-[7px] font-black mb-1 opacity-60", r.text)}>{r.type}</span>
                <span className="text-[10px] font-mono font-black text-zinc-200">{((Number.isFinite(Number(r.val)) ? Number(r.val) : 0) * 100).toFixed(0)}%</span>
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="p-0 border-none bg-transparent">
              {history?.[r.label] && (
                <ModifierBreakdown 
                  history={history} 
                  historyKey={r.label} 
                />
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}
    </div>
  </div>
))

ResistGrid.displayName = 'ResistGrid'

export const DetailedShipStats: React.FC<DetailedShipStatsProps> = ({ stats, className }) => {
  if (!stats) return (
    <div className="flex flex-col items-center justify-center p-12 text-center border border-dashed border-white/10 rounded-2xl bg-black/20 backdrop-blur-sm">
      <Activity className="w-12 h-12 text-zinc-800 mb-4 animate-pulse" />
      <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.2em]">Awaiting Ship Telemetry</span>
    </div>
  )

  const safeNumber = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : fallback
  }
  const cpuPercent = safeNumber(stats?.cpu?.percent)
  const cpuUsed = safeNumber(stats?.cpu?.used)
  const cpuTotal = safeNumber(stats?.cpu?.total)
  const powerPercent = safeNumber(stats?.power?.percent)
  const powerUsed = safeNumber(stats?.power?.used)
  const powerTotal = safeNumber(stats?.power?.total)

  return (
    <div className={cn("flex flex-col gap-4 p-1", className)}>
      {/* HEADER RESOURCES */}
      <div className="flex flex-col gap-3 p-4 bg-zinc-900/80 rounded-2xl border border-white/10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl -z-10" />
        
        {/* CPU */}
        <div className="space-y-1.5">
          <StatRow 
            label="Processor (CPU)" 
            value={cpuUsed} 
            unit={`/ ${cpuTotal.toFixed(1)} tf`} 
            subValue={`${cpuPercent.toFixed(1)}%`}
            color={cpuPercent > 100 ? "text-red-400" : "text-blue-400"}
            historyKey="CPU"
            history={stats.history}
          />
          <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
             <motion.div 
               className={cn("h-full rounded-full", cpuPercent > 100 ? "bg-red-500" : "bg-blue-500")}
               initial={{ width: 0 }}
               animate={{ width: `${Math.min(cpuPercent, 100)}%` }}
               transition={{ duration: 0.8 }}
             />
          </div>
        </div>

        {/* POWER */}
        <div className="space-y-1.5">
          <StatRow 
            label="Reactor (Powergrid)" 
            value={powerUsed} 
            unit={`/ ${powerTotal.toFixed(0)} MW`} 
            subValue={`${powerPercent.toFixed(1)}%`}
            color={powerPercent > 100 ? "text-red-400" : "text-green-400"}
            historyKey="Powergrid"
            history={stats.history}
          />
          <div className="h-1.5 w-full bg-zinc-800/50 rounded-full overflow-hidden border border-white/5">
             <motion.div 
               className={cn("h-full rounded-full", powerPercent > 100 ? "bg-red-500" : "bg-green-500")}
               initial={{ width: 0 }}
               animate={{ width: `${Math.min(powerPercent, 100)}%` }}
               transition={{ duration: 0.8, delay: 0.1 }}
             />
          </div>
        </div>

        {/* HARDPOINTS */}
        <div className="flex gap-4 pt-2 border-t border-white/5 mt-1">
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-black text-zinc-500">
              <span>Turrets</span>
              <span className={stats.hardpoints.turrets.overflow ? "text-red-400" : "text-zinc-300"}>
                {stats.hardpoints.turrets.used} / {stats.hardpoints.turrets.total}
              </span>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className={cn("h-full", stats.hardpoints.turrets.overflow ? "bg-red-500" : "bg-blue-400")} 
                style={{ width: `${Math.min((stats.hardpoints.turrets.used / (stats.hardpoints.turrets.total || 1)) * 100, 100)}%` }} 
              />
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="flex justify-between items-center text-[8px] uppercase font-black text-zinc-500">
              <span>Launchers</span>
              <span className={stats.hardpoints.launchers.overflow ? "text-red-400" : "text-zinc-300"}>
                {stats.hardpoints.launchers.used} / {stats.hardpoints.launchers.total}
              </span>
            </div>
            <div className="h-1 bg-zinc-800/50 rounded-full overflow-hidden">
              <div 
                className={cn("h-full", stats.hardpoints.launchers.overflow ? "bg-red-500" : "bg-orange-400")} 
                style={{ width: `${Math.min((stats.hardpoints.launchers.used / (stats.hardpoints.launchers.total || 1)) * 100, 100)}%` }} 
              />
            </div>
          </div>
        </div>
      </div>

      {/* COMBAT DATA */}
      <div className="grid grid-cols-2 gap-3">
        <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative">
          <Crosshair className="w-3 h-3 text-zinc-600 absolute top-3 left-3" />
          <span className="text-[24px] font-black text-white leading-none tracking-tighter">
            {safeNumber(stats.dps.total).toFixed(1)}
          </span>
          <span className="text-[8px] text-zinc-500 uppercase font-black tracking-[0.2em] mt-1">Total Output</span>
          <div className="flex gap-2 mt-3 opacity-60">
            <span className="text-[8px] font-mono font-bold text-zinc-300">T:{safeNumber(stats.dps.turret).toFixed(0)}</span>
            <span className="text-[8px] font-mono font-bold text-zinc-300">M:{safeNumber(stats.dps.missile).toFixed(0)}</span>
            <span className="text-[8px] font-mono font-bold text-zinc-300">D:{safeNumber(stats.dps.drone).toFixed(0)}</span>
          </div>
        </div>

        <div className="p-4 bg-zinc-900/40 rounded-2xl border border-white/5 flex flex-col items-center justify-center relative">
          <ShieldAlert className="w-3 h-3 text-zinc-600 absolute top-3 left-3" />
          <span className="text-[24px] font-black text-green-400 leading-none tracking-tighter">
            {Math.round(stats.ehp.total).toLocaleString()}
          </span>
          <span className="text-[8px] text-zinc-500 uppercase font-black tracking-[0.2em] mt-1">Total EHP</span>
          <div className="mt-3 flex gap-2">
            <span className="text-[8px] font-mono text-zinc-400">
              {safeNumber(stats.tank.shield.maxRegen).toFixed(1)} HP/s
            </span>
          </div>
        </div>
      </div>

      {/* DEFENSE DETAILS */}
      <Section title="Structural Integrity" icon={Shield} accentColor="text-blue-400">
        <ResistGrid label="Passive Shield" resists={stats.resistance.shield} hp={stats.tank.shield.hp} iconColor="text-blue-500" type="Shield" history={stats.history} />
        <div className="h-4" />
        <ResistGrid label="Armor Plating" resists={stats.resistance.armor} hp={stats.tank.armor.hp} iconColor="text-red-500" type="Armor" history={stats.history} />
        <div className="h-4" />
        <ResistGrid label="Hull Structure" resists={stats.resistance.hull} hp={stats.tank.hull.hp} iconColor="text-yellow-600" type="Hull" history={stats.history} />
      </Section>

      {/* CAPACITOR & ENERGY */}
      <Section title="Energy Systems" icon={Zap} accentColor="text-yellow-400">
        <div className="flex justify-between items-center mb-4 p-2 bg-black/20 rounded-lg">
           <div className="flex flex-col">
              <span className={cn("text-[10px] font-black uppercase tracking-widest", stats.capacitor.stable ? "text-green-400" : "text-red-400")}>
                {stats.capacitor.stable ? 'Stable Energy' : 'Capacitor Failure'}
              </span>
              <span className="text-[8px] text-zinc-500 font-mono">
                {stats.capacitor.stable ? 'Continuous Operation' : `Depletion in ${Math.floor(stats.capacitor.timeToEmpty)}s`}
              </span>
           </div>
           <div className="text-right">
              <div className={cn("text-[14px] font-black font-mono", safeNumber(stats.capacitor.deltaPerSecond) >= 0 ? "text-green-400" : "text-red-400")}>
                {safeNumber(stats.capacitor.deltaPerSecond) > 0 ? '+' : ''}{safeNumber(stats.capacitor.deltaPerSecond).toFixed(1)} <span className="text-[8px] opacity-60">GJ/s</span>
              </div>
           </div>
        </div>
        <StatRow label="Stored Energy" value={stats.capacitor.capacity} unit="GJ" historyKey="Capacitor" history={stats.history} />
        <StatRow label="Recharge Time" value={stats.capacitor.rechargeRate} unit="S" historyKey="Capacitor Recharge Time" history={stats.history} />
      </Section>

      {/* ELECTRONICS & NAVIGATION */}
      <Section title="Sensor Suites" icon={Target} accentColor="text-purple-400">
        <div className="grid grid-cols-2 gap-x-4">
          <StatRow label="Targets" value={stats.targeting.maxTargets} historyKey="Max Locked Targets" history={stats.history} />
          <StatRow label="Sig Radius" value={stats.targeting.signature} unit="M" historyKey="Signature Radius" history={stats.history} />
          <StatRow label="Target Range" value={stats.targeting.range} unit="KM" historyKey="Max Target Range" history={stats.history} />
          <StatRow label="Scan Res" value={stats.targeting.scanRes} unit="MM" historyKey="Scan Resolution" history={stats.history} />
        </div>
      </Section>
      
      <Section title="Propulsion" icon={Wind} accentColor="text-orange-400">
         <div className="grid grid-cols-2 gap-x-4">
          <StatRow label="Base Velocity" value={stats.velocity.maxSpeed} unit="M/S" historyKey="Max Speed" history={stats.history} />
          <StatRow label="Warp Drive" value={stats.velocity.warpSpeed} unit="AU/S" historyKey="Warp Speed" history={stats.history} />
          <StatRow label="Alignment" value={stats.velocity.alignTime} unit="S" historyKey="Alignment Time" history={stats.history} />
          <StatRow label="Mass" value={stats.mass || 0} unit="KG" historyKey="Mass" history={stats.history} />
        </div>
      </Section>

      {/* FOOTER */}
      <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/5 flex justify-between items-center opacity-80">
        <div className="flex items-center gap-2">
          <Layers className="w-3 h-3 text-zinc-700" />
          <span className="text-[9px] font-mono text-zinc-600 uppercase mt-0.5">Estimated Hull Value</span>
        </div>
        <span className="text-[10px] font-black text-zinc-400 font-mono">0.00 ISK</span>
      </div>
    </div>
  )
}

export default DetailedShipStats;
