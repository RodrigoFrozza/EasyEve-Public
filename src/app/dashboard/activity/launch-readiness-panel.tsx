'use client'

import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type LaunchReadinessPanelProps = {
  score: number
  issues: string[]
}

export function LaunchReadinessPanel({ score, issues }: LaunchReadinessPanelProps) {
  const isReady = issues.length === 0

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
          Readiness Score
        </span>
        <span className={cn('text-xs font-black', isReady ? 'text-emerald-400' : 'text-amber-300')}>
          {score}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-zinc-800">
        <div
          className={cn('h-full rounded-full transition-all', isReady ? 'bg-emerald-500' : 'bg-amber-400')}
          style={{ width: `${score}%` }}
        />
      </div>
      <div className="space-y-1 text-[10px]">
        {isReady ? (
          <p className="flex items-center gap-2 font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" />
            All required fields are complete.
          </p>
        ) : (
          issues.map((issue) => (
            <p key={issue} className="flex items-center gap-2 text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {issue}
            </p>
          ))
        )}
      </div>
    </div>
  )
}
