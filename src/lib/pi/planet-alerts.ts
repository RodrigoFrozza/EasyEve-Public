import { getCommodityName } from '@/lib/pi/pi-static-data'
import type { PiColonyAnalysis } from '@/lib/pi/types'

export type PiAlertType =
  | 'starving_soon'
  | 'degraded'
  | 'stalled'
  | 'overflow_soon'
  | 'full'
  | 'extractor_expired'

export type PiAlertSeverity = 'amber' | 'red'

/** 0 = colony-level alert (no specific pin — real ESI pin ids are always > 0). */
export const COLONY_LEVEL_PIN_ID = 0

export interface PiAlertCandidate {
  alertType: PiAlertType
  /** COLONY_LEVEL_PIN_ID for buffer alerts, the extractor's pin id for extractor_expired. */
  pinId: number
  typeId?: number
  typeName?: string
  severity: PiAlertSeverity
  timeToStopHrs?: number
  timeToFullHrs?: number
  planetId: number
  characterId: number
}

/**
 * Derives which alerts currently apply to a colony from fields `analyzeColonyLayout`
 * already computed (bufferStatusCurrent, extractors) — no recomputation, no ESI/pricing.
 * Uses the CURRENT (real) buffer state, not the potential/designed one, so an alert
 * reflects what's actually happening right now, matching colony-warnings.ts's UI severity.
 */
export function deriveAlertCandidates(colony: PiColonyAnalysis): PiAlertCandidate[] {
  const candidates: PiAlertCandidate[] = []
  const base = { planetId: colony.planetId, characterId: colony.characterId }

  const buffer = colony.bufferStatusCurrent
  switch (buffer.status) {
    case 'stalled':
      candidates.push({
        ...base,
        alertType: 'stalled',
        pinId: COLONY_LEVEL_PIN_ID,
        typeId: buffer.limitingTypeId,
        typeName: buffer.limitingTypeId ? getCommodityName(buffer.limitingTypeId) : undefined,
        severity: 'red',
      })
      break
    case 'degraded':
      candidates.push({
        ...base,
        alertType: 'degraded',
        pinId: COLONY_LEVEL_PIN_ID,
        typeId: buffer.limitingTypeId,
        typeName: buffer.limitingTypeId ? getCommodityName(buffer.limitingTypeId) : undefined,
        severity: 'amber',
      })
      break
    case 'starving_soon':
      candidates.push({
        ...base,
        alertType: 'starving_soon',
        pinId: COLONY_LEVEL_PIN_ID,
        typeId: buffer.limitingTypeId,
        typeName: buffer.limitingTypeId ? getCommodityName(buffer.limitingTypeId) : undefined,
        severity: 'amber',
        timeToStopHrs: buffer.timeToStopHrs,
      })
      break
    case 'overflow_soon':
      candidates.push({
        ...base,
        alertType: 'overflow_soon',
        pinId: COLONY_LEVEL_PIN_ID,
        severity: 'amber',
        timeToFullHrs: buffer.timeToFullHrs,
      })
      break
    case 'full':
      candidates.push({
        ...base,
        alertType: 'full',
        pinId: COLONY_LEVEL_PIN_ID,
        severity: 'red',
      })
      break
    case 'running':
      break
  }

  for (const extractor of colony.extractors) {
    if (!extractor.isExpired) continue
    candidates.push({
      ...base,
      alertType: 'extractor_expired',
      pinId: extractor.pinId,
      typeId: extractor.productTypeId,
      typeName: extractor.productName,
      severity: 'red',
    })
  }

  return candidates
}

export interface PiPlanetAlertRecord {
  lastNotifiedAt: Date
  resolvedAt: Date | null
}

/**
 * No existing record -> notify (first time we see this problem).
 * Existing record with resolvedAt set -> the condition had cleared and came back;
 * notify immediately even inside the cooldown window (a second crisis must never
 * be silenced just because an earlier, different occurrence used up the cooldown).
 * Existing open record (resolvedAt null) -> only notify again once cooldownHrs
 * has passed since the last notification, to avoid re-alerting every scheduler tick.
 */
export interface PiAlertPlace {
  planetName: string
  systemName: string
}

export interface PiAlertMessage {
  title: string
  content: string
}

/**
 * Notification text. pt-BR — matches the corp's own docs/comms; the rest of the
 * codebase writes automated-notification content as final strings at creation
 * time (see auto-activity-detection.ts) rather than through the i18n key system,
 * which is for client-rendered UI, not server-persisted content. Language is an
 * open call — trivial to change here if the wrong default.
 */
export function buildAlertMessage(candidate: PiAlertCandidate, place: PiAlertPlace): PiAlertMessage {
  const where = `${place.planetName} (${place.systemName})`
  switch (candidate.alertType) {
    case 'stalled':
      return {
        title: 'PI: colônia parada',
        content: `${where} ficou sem buffer e a produção parou${
          candidate.typeName ? ` — faltando ${candidate.typeName}` : ''
        }.`,
      }
    case 'degraded':
      return {
        title: 'PI: colônia degradada',
        content: `${where} está produzindo abaixo do desenhado — algum insumo faltando${
          candidate.typeName ? ` (${candidate.typeName})` : ''
        }.`,
      }
    case 'starving_soon': {
      const hrs =
        candidate.timeToStopHrs != null ? Math.max(0, Math.round(candidate.timeToStopHrs)) : undefined
      return {
        title: 'PI: buffer esvaziando em breve',
        content: `${where} vai ficar sem buffer${hrs != null ? ` em ~${hrs}h` : ''}${
          candidate.typeName ? ` (${candidate.typeName})` : ''
        }.`,
      }
    }
    case 'overflow_soon': {
      const hrs =
        candidate.timeToFullHrs != null ? Math.max(0, Math.round(candidate.timeToFullHrs)) : undefined
      return {
        title: 'PI: storage prestes a lotar',
        content: `${where} vai lotar o storage${hrs != null ? ` em ~${hrs}h` : ''}.`,
      }
    }
    case 'full':
      return {
        title: 'PI: storage lotado',
        content: `${where} está com o storage cheio — produção pode estar sendo perdida.`,
      }
    case 'extractor_expired':
      return {
        title: 'PI: extrator expirado',
        content: `${where}: o extrator${
          candidate.typeName ? ` de ${candidate.typeName}` : ''
        } (pin ${candidate.pinId}) expirou — reabra a colônia in-game e faça o resurvey.`,
      }
  }
}

export function shouldNotify(
  existing: PiPlanetAlertRecord | undefined,
  now: Date,
  cooldownHrs: number
): boolean {
  if (!existing) return true
  if (existing.resolvedAt !== null) return true
  const hoursSinceNotified = (now.getTime() - existing.lastNotifiedAt.getTime()) / 3_600_000
  return hoursSinceNotified >= cooldownHrs
}
