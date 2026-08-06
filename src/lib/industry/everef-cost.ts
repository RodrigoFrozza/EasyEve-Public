import { logger } from '@/lib/server-logger'
import { parseIsoDurationToSeconds, clampTe } from '@/lib/industry/build-time'
import type { FactoryConfig } from '@/lib/industry/config-types'

const EVEREF_COST_URL = 'https://api.everef.net/v1/industry/cost'
const TIMEOUT_MS = 8000

export interface EverefJobCost {
  total: number
  sccSurcharge: number
  facilityTax: number
  eiv: number
}

/** Industry skill levels passed to EVE Ref so the returned time reflects them. */
export interface IndustrySkillLevels {
  industry: number
  advancedIndustry: number
}

export interface EverefCostResult {
  materials: Record<number, number>
  /** Null when the response had no job-cost fields (e.g. system_id wasn't sent). */
  jobCost: EverefJobCost | null
  /**
   * Whole-job build time in seconds, already adjusted for TE + structure + rigs
   * + security + the skills we passed. Null when EVE Ref didn't return a time we
   * could parse — the caller falls back to the local base×TE estimate.
   */
  buildTimeSeconds: number | null
}

/**
 * Rig/ME/security-adjusted manufacturing material quantities AND job installation
 * cost from EVE Ref's public industry-cost API. Materials: adjusted quantity per
 * material typeId for the whole job (already ME- and rig-reduced) — we price
 * those with our own order book, ignoring EVE Ref's prices. Job cost: EVE Ref
 * also applies structure job-cost bonuses (which we could not confirm from a
 * primary source), so this is the preferred source for job cost over the local
 * fallback in job-cost.ts.
 *
 * Returns null on any failure (timeout, non-200, unexpected shape) so the caller
 * can fall back to the local ME formula and warn — never silently drop the rig
 * discount or block the calculation (regra de ouro / falha nunca invisível).
 *
 * @see https://docs.everef.net/api/industry-cost.html
 */
export async function fetchRigAdjustedMaterials(params: {
  productTypeId: number
  runs: number
  me: number
  te: number
  factory: FactoryConfig
  skills?: IndustrySkillLevels | null
}): Promise<EverefCostResult | null> {
  const { productTypeId, runs, me, te, factory, skills } = params
  if (factory.structureTypeId == null) return null // NPC station has no rig bonuses

  const qs = new URLSearchParams()
  qs.set('product_id', String(productTypeId))
  qs.set('runs', String(Math.max(1, Math.floor(runs))))
  qs.set('me', String(Math.max(0, Math.min(10, Math.floor(me)))))
  qs.set('te', String(clampTe(te)))
  qs.set('structure_type_id', String(factory.structureTypeId))
  qs.set('security', factory.security)
  for (const rig of factory.rigs) qs.append('rig_id', String(rig.typeId))
  if (factory.solarSystemId != null) qs.set('system_id', String(factory.solarSystemId))
  if (factory.facilityTaxPct > 0) qs.set('facility_tax', String(factory.facilityTaxPct / 100))
  // Skills reduce job time. Only sent when we have real levels — omitting them
  // makes EVE Ref assume 0, which overstates time (conservative), never optimistic.
  if (skills) {
    qs.set('industry', String(Math.max(0, Math.min(5, Math.floor(skills.industry)))))
    qs.set('advanced_industry', String(Math.max(0, Math.min(5, Math.floor(skills.advancedIndustry)))))
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${EVEREF_COST_URL}?${qs.toString()}`, {
      headers: { 'User-Agent': 'EasyEve/industry (https://github.com/RodrigoFrozza/EasyEve_)' },
      signal: controller.signal,
    })
    if (!res.ok) {
      logger.warn('INDUSTRY_EVEREF', `EVE Ref cost API ${res.status} for product ${productTypeId}`)
      return null
    }
    const data = (await res.json()) as {
      manufacturing?: Record<
        string,
        {
          materials?: Record<string, { type_id: number; quantity: number }>
          total_job_cost?: number
          scc_surcharge?: number
          facility_tax?: number
          estimated_item_value?: number
          time?: string
        }
      >
    }
    const job = data.manufacturing?.[String(productTypeId)]
    const materials = job?.materials
    if (!materials) {
      logger.warn('INDUSTRY_EVEREF', `EVE Ref response had no manufacturing materials for ${productTypeId}`)
      return null
    }

    const out: Record<number, number> = {}
    for (const m of Object.values(materials)) {
      if (typeof m?.type_id === 'number' && typeof m?.quantity === 'number' && m.quantity > 0) {
        out[m.type_id] = m.quantity
      }
    }
    if (Object.keys(out).length === 0) return null

    const jobCost: EverefJobCost | null =
      typeof job?.total_job_cost === 'number' &&
      typeof job?.scc_surcharge === 'number' &&
      typeof job?.facility_tax === 'number' &&
      typeof job?.estimated_item_value === 'number'
        ? {
            total: job.total_job_cost,
            sccSurcharge: job.scc_surcharge,
            facilityTax: job.facility_tax,
            eiv: job.estimated_item_value,
          }
        : null

    const buildTimeSeconds = typeof job?.time === 'string' ? parseIsoDurationToSeconds(job.time) : null

    return { materials: out, jobCost, buildTimeSeconds }
  } catch (error) {
    logger.warn('INDUSTRY_EVEREF', `EVE Ref cost API call failed for ${productTypeId}`, error)
    return null
  } finally {
    clearTimeout(timer)
  }
}
