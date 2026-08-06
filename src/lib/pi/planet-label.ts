import type { PiColonyAnalysis } from '@/lib/pi/types'
import { getColonyWarningState } from '@/lib/pi/colony-warnings'

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export function formatPiPlanetTooltip(colony: PiColonyAnalysis, t?: TranslateFn): string {
  const name = colony.planetName ?? colony.solarSystemName
  const lines = [`${colony.planetTypeLabel} - ${name}`]
  const { hasExpired, isStale, warningCount } = getColonyWarningState(colony)

  if (t) {
    if (hasExpired) lines.push(t('pi.planet.expiredExtractor'))
    if (isStale) lines.push(t('pi.planet.stale'))
    if (warningCount > 0) {
      lines.push(t('pi.warnings.count', { count: warningCount }))
    }
  } else {
    if (hasExpired) lines.push('Extractor expired')
    if (isStale) lines.push('Stale data')
    if (warningCount > 0) lines.push(`${warningCount} warning(s)`)
  }

  return lines.join('\n')
}
