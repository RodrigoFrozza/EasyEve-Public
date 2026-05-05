'use client'

import { Wallet } from 'lucide-react'
import { cn, formatISK, formatNumber } from '@/lib/utils'
import Image from 'next/image'
import type { Activity } from '@/lib/stores/activity-store'
import { useTranslations } from '@/i18n/hooks'

interface FinancialDashboardProps {
  activity: Activity
  mounted: boolean
  iskPerHour: number | null
  estimatedLootValue: number
  estimatedSalvageValue: number
}

export function FinancialDashboard({ 
  activity, 
  mounted, 
  iskPerHour,
  estimatedLootValue,
  estimatedSalvageValue
}: FinancialDashboardProps) {
  const { t } = useTranslations()

  return (
    <div className="bg-zinc-950/30 p-4 rounded-xl border border-zinc-900/50 space-y-4 backdrop-blur-sm relative overflow-hidden group/fin">
      <div className={cn(
        "absolute top-0 right-0 p-8 blur-3xl rounded-full -mr-10 -mt-10",
        activity.type === 'ratting' ? "bg-green-500/5" : "bg-cyan-500/5"
      )} />
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-3 w-1 rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]",
            activity.type === 'ratting' ? "bg-green-500" : "bg-cyan-500 shadow-[0_0_8px_rgba(0,255,255,0.4)]"
          )} />
          <span className={cn(
            "text-[10px] uppercase font-black tracking-[0.2em]",
            activity.type === 'ratting' ? "text-green-400" : "text-cyan-400"
          )}>
            {activity.type === 'exploration' ? t('activity.sitesDone') : activity.type === 'ratting' ? t('activity.bountyAnalytics') : t('activity.extractionYield')}
          </span>
        </div>
        <Wallet className={cn(
          "h-4 w-4 text-zinc-800 transition-colors duration-500",
          activity.type === 'ratting' ? "group-hover/fin:text-green-500/50" : "group-hover/fin:text-cyan-500/50"
        )} />
      </div>
      
      <div className="grid grid-cols-2 gap-4 relative z-10">
        <div className="space-y-1">
          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{t('activity.netProfit')}</p>
          <p className={cn(
            "text-2xl font-bold font-mono tracking-tighter leading-none",
            activity.type === 'ratting' ? "text-green-400" : "text-cyan-400"
          )}>
            {formatISK(
              (activity.data?.automatedBounties || 0) + 
              (activity.data?.automatedEss || 0) + 
              (activity.data?.additionalBounties || 0) +
              (activity.data?.miningValue || activity.data?.totalEstimatedValue || 0) +
              estimatedLootValue +
              estimatedSalvageValue
            )}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest">{t('activity.efficiency')}</p>
          <p className="text-2xl font-bold text-white font-mono tracking-tighter leading-none" suppressHydrationWarning>
            {mounted && iskPerHour !== null ? formatISK(iskPerHour) : formatISK(0)}/h
          </p>
        </div>
      </div>

      {activity.type === 'mining' && (
        <div className="pt-2 relative z-10">
           <p className="text-[9px] text-zinc-500 uppercase font-black tracking-widest leading-none mb-2">{t('activity.extractionSummary')}</p>
           <div className="flex flex-wrap gap-2">
             {Object.entries(activity.data?.oreBreakdown || {}).slice(0, 4).map(([typeId, data]: [string, any]) => (
               <div key={typeId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800/50 group/ore hover:border-blue-500/30 transition-colors">
                 <Image 
                   src={`https://images.evetech.net/types/${typeId}/icon?size=32`} 
                   alt="Ore"
                   width={32}
                   height={32}
                   className="h-5 w-5 rounded-sm"
                 />
                 <div className="flex flex-col">
                   <span className="text-[10px] font-bold text-zinc-100">{formatNumber(Math.round(data.volumeValue || data.quantity))}</span>
                   <span className="text-[8px] text-zinc-500 font-mono">m³</span>
                 </div>
               </div>
             ))}
           </div>
        </div>
      )}
    </div>
  )
}
