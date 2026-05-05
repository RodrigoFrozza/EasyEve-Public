'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

import { ShipStats, Modifier, AttributeHistory } from '@/types/fit'
import { useTranslations } from '@/i18n/hooks'

interface ModifierBreakdownProps {
  history?: ShipStats['history'] | ShipStats['slotHistory']
  historyKey?: string
  showTotal?: boolean
  /** Softer surface when nested inside the fitted-module tooltip (avoids stacked heavy chrome). */
  embedded?: boolean
  // Direct props support
  label?: string
  base?: number
  final?: number
  modifiers?: Modifier[]
  unit?: string
}

function modifierBreakdownShellClass(showTotal: boolean, embedded: boolean) {
  return cn(
    'flex flex-col gap-1',
    showTotal &&
      cn(
        'pointer-events-none w-full min-w-0 max-w-full rounded-md border p-2.5 text-left',
        embedded
          ? 'border-border/70 bg-muted/25 text-foreground'
          : 'w-max min-w-[240px] max-w-[min(22rem,92vw)] border-border bg-popover text-popover-foreground shadow-lg'
      )
  )
}

export const ModifierBreakdown: React.FC<ModifierBreakdownProps> = ({
  history,
  historyKey,
  showTotal = true,
  embedded = false,
  label: directLabel,
  base: directBase,
  final: directFinal,
  modifiers: directModifiers,
  unit
}) => {
  const { t } = useTranslations()
  const data = (history && historyKey ? (history as Record<string, AttributeHistory>)[historyKey] : null) as AttributeHistory | null
  const base = directBase !== undefined ? directBase : (data?.base || 0)
  const final = directFinal !== undefined ? directFinal : (data?.final || 0)
  const modifiers: Modifier[] = directModifiers || data?.modifiers || []
  const label = directLabel || historyKey || 'Attribute'

  if (!data && directBase === undefined && (!modifiers || modifiers.length === 0)) return null

  return (
    <div className={modifierBreakdownShellClass(showTotal, embedded)}>
      {showTotal && (
        <div className="flex items-start justify-between gap-2 border-b border-border/80 pb-2">
          <h4 className="flex min-w-0 items-start gap-1.5 text-xs font-semibold leading-snug tracking-tight text-foreground">
            <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="min-w-0 break-words">{label}</span>
          </h4>
        </div>
      )}

      <div className="space-y-2">
        {showTotal && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-2.5 py-1.5">
            <span className="shrink-0 text-xs font-medium text-muted-foreground">
              {t('fits.modifierBreakdown.startingValue')}
            </span>
            <span className="text-right font-mono text-sm tabular-nums text-foreground">
              {base.toLocaleString()}
            </span>
          </div>
        )}

        <div className="space-y-1">
          {modifiers && modifiers.length > 0 ? (
            modifiers.map((mod: Modifier, i: number) => (
              <div
                key={i}
                className="flex gap-2 rounded-md px-1.5 py-1 hover:bg-muted/25"
              >
                <span className="min-w-0 flex-1 break-words text-left text-xs font-medium leading-snug text-muted-foreground">
                  {mod.source}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  <span className={cn(
                    'font-mono text-xs font-semibold tabular-nums',
                    mod.impact === 'positive' ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                  )}>
                    {mod.impact === 'positive' && mod.value > 0 && mod.type !== 'multiplier' ? '+' : ''}
                    {mod.type === 'percent' ? `${mod.value}%` : mod.type === 'multiplier' ? `×${mod.value}` : mod.value}
                  </span>
                  {mod.impact === 'positive' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-600/70 dark:text-emerald-400/70" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-destructive/70" />
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-md px-2 py-2 text-center">
              <span className="text-[11px] leading-snug text-muted-foreground">
                {t('fits.modifierBreakdown.noModifiers')}
              </span>
            </div>
          )}
        </div>

        {showTotal && (
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="shrink-0 text-xs font-semibold text-foreground">
              {t('fits.modifierBreakdown.result')}
            </span>
            <span className={cn(
              'text-right font-mono text-lg font-bold tabular-nums',
              (final > base && !label.toLowerCase().includes('radius')) || (final < base && label.toLowerCase().includes('radius'))
                ? 'text-primary'
                : 'text-foreground'
            )}>
              {unit === '%' ? (final * 100).toFixed(0) : final.toLocaleString()}{unit}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
