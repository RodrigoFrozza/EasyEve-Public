import type { PiColonyAnalysis } from '@/lib/pi/types'

export type ColonyWarningSeverity = 'none' | 'amber' | 'red'

export function getColonyWarningState(colony: PiColonyAnalysis): {
  severity: ColonyWarningSeverity
  hasExpired: boolean
  isStale: boolean
  warningCount: number
} {
  const warningCount = colony.warnings.length
  const hasExpired = colony.extractors.some((e) => e.isExpired)
  const isStale = colony.isStale

  let severity: ColonyWarningSeverity = 'none'
  if (hasExpired) {
    severity = 'red'
  } else if (isStale || warningCount > 0) {
    severity = 'amber'
  }

  return { severity, hasExpired, isStale, warningCount }
}
