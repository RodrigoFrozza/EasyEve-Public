'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { deriveAlertCandidates, type PiAlertType } from '@/lib/pi/planet-alerts'
import type { PiColonyAnalysis } from '@/lib/pi/types'

type Props = {
  colonies: PiColonyAnalysis[]
}

// Order the breakdown worst-first: red severities before amber ones.
const ALERT_ORDER: PiAlertType[] = [
  'stalled',
  'full',
  'extractor_expired',
  'degraded',
  'starving_soon',
  'overflow_soon',
]

function colonyKey(colony: PiColonyAnalysis): string {
  return `${colony.characterId}-${colony.planetId}`
}

/**
 * Portfolio-level "N colonies with a problem right now" banner. Reuses
 * planet-alerts.ts's deriveAlertCandidates — the same classification already
 * driving the background notification script — so a user sees the same
 * problem set in-app, session-visible, without a new server route or any
 * persisted state (this component is purely a client-side summary of
 * PiColonyAnalysis data the /api/pi/colonies response already contains).
 */
export function PiPortfolioAlertBanner({ colonies }: Props) {
  const { t } = useTranslations()

  const { colonyCount, hasRed, breakdown } = useMemo(() => {
    const colonyKeysByType = new Map<PiAlertType, Set<string>>()
    const allColonyKeys = new Set<string>()
    let hasRedSeverity = false

    for (const colony of colonies) {
      const key = colonyKey(colony)
      for (const candidate of deriveAlertCandidates(colony)) {
        allColonyKeys.add(key)
        if (candidate.severity === 'red') hasRedSeverity = true
        const set = colonyKeysByType.get(candidate.alertType) ?? new Set<string>()
        set.add(key)
        colonyKeysByType.set(candidate.alertType, set)
      }
    }

    return {
      colonyCount: allColonyKeys.size,
      hasRed: hasRedSeverity,
      breakdown: ALERT_ORDER.map((alertType) => ({
        alertType,
        count: colonyKeysByType.get(alertType)?.size ?? 0,
      })).filter((entry) => entry.count > 0),
    }
  }, [colonies])

  if (colonyCount === 0) return null

  return (
    <div
      className={cn(
        'rounded-xl border p-4 text-sm',
        hasRed
          ? 'border-red-500/30 bg-red-500/10 text-red-200'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
      )}
    >
      <p className="font-semibold">
        {t('pi.portfolioAlerts.headline', { count: colonyCount })}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-90">
        {breakdown.map(({ alertType, count }) => (
          <span key={alertType}>
            {t(`pi.portfolioAlerts.breakdown.${alertType}`, { count })}
          </span>
        ))}
      </div>
    </div>
  )
}
