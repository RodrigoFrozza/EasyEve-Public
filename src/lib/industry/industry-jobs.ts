import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { getValidAccessToken } from '@/lib/token-manager'
import { withEsiRetry } from '@/lib/esi-retry'
import { logger } from '@/lib/server-logger'

/**
 * Multi-character Industry Jobs dashboard: a unified view of active/ready industry
 * jobs across every character, so nobody has to log into each alt to check.
 *
 * ESI field semantics confirmed against https://esi.evetech.net/latest/swagger.json
 * (GET /characters/{character_id}/industry/jobs/), checked 2026-07-17:
 *   - Scope: esi-industry.read_character_jobs.v1 (already in src/lib/constants/scopes.ts).
 *   - Query params: `include_completed` (boolean, optional, default false per ESI —
 *     "Whether to retrieve completed character industry jobs. Only includes jobs
 *     from the past 90 days"). We always pass true: completed-but-undelivered jobs
 *     (status 'ready') are the most actionable ones for this dashboard.
 *   - NO pagination: the response schema has no x-pages parameter and no `page`
 *     query param (unlike GET /characters/{id}/blueprints/) — it's a single array,
 *     capped at maxItems 2000 by the spec. One request per character, not paginated.
 *   - Response does NOT include a solar system id anywhere. Only `facility_id`
 *     (int64, "ID of the facility where this job is running") and `station_id`
 *     (int64, "ID of the station where industry facility is located"). We surface
 *     facility_id as-is and do NOT resolve or invent a system/station name from it.
 *   - `product_type_id` (int32) is NOT in the `required` list of the response
 *     schema — absent for jobs that don't produce a tradeable product (TE/ME
 *     research, copying). Treated as nullable.
 *   - `status` enum (exact values from the spec): active, cancelled, delivered,
 *     paused, ready, reverted. "ready" = completed and awaiting delivery to a
 *     hangar — the most useful state to highlight. We pass include_completed=true
 *     only to surface `ready` jobs; the endpoint ALSO returns terminal jobs from
 *     the past 90 days (delivered/cancelled/reverted), which are noise for a
 *     "what's running / what's ready to pick up" dashboard and are filtered out
 *     (see ACTIONABLE_STATUSES) before name resolution and caching.
 *   - `job_id`, `activity_id`, `blueprint_type_id`, `runs`, `start_date`, `end_date`
 *     are all in the schema's `required` list.
 *   - `facility_id` is ESI int64 — stored/returned as a string (never let a BigInt
 *     reach NextResponse.json), same convention as src/lib/pi/structure-market.ts.
 *
 * activity_id -> name mapping: NOT documented by the ESI endpoint itself (it's SDE
 * static data). Confirmed against the current SDE mirror
 * https://sde.hoboleaks.space/tq/industryactivities.json on 2026-07-17:
 *   1 = Manufacturing, 3 = Time Efficiency Research, 4 = Material Efficiency
 *   Research, 5 = Copying, 8 = Invention, 9 = Reactions.
 * IDs 2, 6, 7 do not exist in the current SDE (6/7 were the old T3 "Duplicating" /
 * "Reverse Engineering" activities, removed from the live data). Any activity_id
 * outside this map renders as "Activity {id}" rather than being guessed.
 */

const LOG_TAG = 'INDUSTRY_JOBS'

export const ACTIVITY_NAMES: Record<number, string> = {
  1: 'Manufacturing',
  3: 'Time Efficiency Research',
  4: 'Material Efficiency Research',
  5: 'Copying',
  8: 'Invention',
  9: 'Reactions',
}

export function activityName(activityId: number): string {
  return ACTIVITY_NAMES[activityId] ?? `Activity ${activityId}`
}

const CACHE_KEY_PREFIX = 'industry_jobs_'
const CACHE_TTL_MS = 3 * 60 * 1000 // 3 min — jobs are live data, short cache only
const STALE_SERVE_MAX_AGE_MS = 30 * 60 * 1000 // serve a stale cache on total ESI failure if <30min old

// This dashboard answers "what's running / what's ready to pick up". include_completed=true
// makes ESI also return terminal jobs from the past 90 days (delivered/cancelled/reverted) —
// pure noise here, and up to 90 days of them per alt. Keep only the live/actionable states.
const ACTIONABLE_STATUSES: ReadonlySet<EsiIndustryJob['status']> = new Set(['active', 'paused', 'ready'])

interface EsiIndustryJob {
  job_id: number
  installer_id: number
  facility_id: number
  station_id: number
  activity_id: number
  blueprint_id: number
  blueprint_type_id: number
  blueprint_location_id: number
  output_location_id: number
  runs: number
  status: 'active' | 'cancelled' | 'delivered' | 'paused' | 'ready' | 'reverted'
  duration: number
  start_date: string
  end_date: string
  product_type_id?: number
  completed_character_id?: number
  completed_date?: string
  cost?: number
  licensed_runs?: number
  pause_date?: string
  probability?: number
  successful_runs?: number
}

export interface IndustryJob {
  jobId: number
  characterId: number
  characterName: string
  activityId: number
  activityName: string
  productTypeId: number | null
  productName: string | null
  blueprintTypeId: number
  blueprintName: string
  runs: number
  startDate: string
  endDate: string
  status: EsiIndustryJob['status']
  ready: boolean
  facilityId: string
}

async function fetchCharacterJobs(characterId: number, accessToken: string): Promise<EsiIndustryJob[]> {
  return withEsiRetry(async () => {
    const res = await esiClient.get(`/characters/${characterId}/industry/jobs/`, {
      params: { include_completed: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    return Array.isArray(res.data) ? (res.data as EsiIndustryJob[]) : []
  })
}

interface CachedPayload {
  jobs: RawJobWithNames[]
  fetchedAt: number
}

// Cache stores jobs already merged with resolved names (character/type names rarely
// change within a 3-minute TTL, so no need to re-resolve on a cache hit).
type RawJobWithNames = IndustryJob

function cacheKey(userId: string): string {
  return `${CACHE_KEY_PREFIX}${userId}`
}

async function readCache(userId: string): Promise<CachedPayload | null> {
  const row = await prisma.sdeCache.findUnique({ where: { key: cacheKey(userId) } })
  if (!row) return null
  const value = row.value as unknown as CachedPayload
  if (!value || !Array.isArray(value.jobs) || typeof value.fetchedAt !== 'number') return null
  return value
}

async function writeCache(userId: string, payload: CachedPayload): Promise<void> {
  const key = cacheKey(userId)
  await prisma.sdeCache.upsert({
    where: { key },
    create: { key, value: payload as any, expiresAt: new Date(payload.fetchedAt + CACHE_TTL_MS) },
    update: { value: payload as any, expiresAt: new Date(payload.fetchedAt + CACHE_TTL_MS) },
  })
}

export interface GetUserIndustryJobsResult {
  jobs: IndustryJob[]
  failed: number[]
  fetchedAt: number
  stale?: boolean
}

/**
 * Fetch every character's active/ready industry jobs, merge, resolve names, and
 * sort soonest-first. A per-character ESI failure is collected in `failed` and
 * never hides the others (degrade per-item, per CLAUDE.md). On TOTAL ESI failure
 * (every character failed) we fall back to a cache that's still reasonably fresh
 * (<30 min) and flag it `stale`; otherwise we return whatever succeeded (possibly
 * empty) — never a silently-defaulted value.
 */
export async function getUserIndustryJobs(
  userId: string,
  characterIds: number[],
  opts?: { forceRefresh?: boolean }
): Promise<GetUserIndustryJobsResult> {
  if (characterIds.length === 0) return { jobs: [], failed: [], fetchedAt: Date.now() }

  if (!opts?.forceRefresh) {
    const cached = await readCache(userId)
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return { jobs: cached.jobs, failed: [], fetchedAt: cached.fetchedAt }
    }
  }

  const characters = await prisma.character.findMany({
    where: { id: { in: characterIds } },
    select: { id: true, name: true },
  })
  const characterNameById = new Map(characters.map((c) => [c.id, c.name]))

  const failed: number[] = []
  const rawJobs: { characterId: number; job: EsiIndustryJob }[] = []

  await Promise.all(
    characterIds.map(async (characterId) => {
      try {
        const { accessToken } = await getValidAccessToken(characterId)
        if (!accessToken) {
          logger.warn(LOG_TAG, `No access token for character ${characterId}`)
          failed.push(characterId)
          return
        }
        const jobs = await fetchCharacterJobs(characterId, accessToken)
        for (const job of jobs) rawJobs.push({ characterId, job })
      } catch (error) {
        logger.warn(LOG_TAG, `Industry jobs fetch failed for character ${characterId}`, error)
        failed.push(characterId)
      }
    })
  )

  // Total failure (every requested character errored, nothing fetched at all):
  // serve a still-usable cache instead of a hard error, flagged stale.
  if (failed.length === characterIds.length) {
    const cached = await readCache(userId)
    if (cached && Date.now() - cached.fetchedAt < STALE_SERVE_MAX_AGE_MS) {
      return { jobs: cached.jobs, failed, fetchedAt: cached.fetchedAt, stale: true }
    }
  }

  // Drop terminal jobs (delivered/cancelled/reverted) BEFORE name resolution and
  // caching, so the cache holds only actionable jobs too.
  const actionableJobs = rawJobs.filter(({ job }) => ACTIONABLE_STATUSES.has(job.status))

  // Resolve type names: blueprint_type_id and product_type_id, batched in one query.
  const typeIds = new Set<number>()
  for (const { job } of actionableJobs) {
    typeIds.add(job.blueprint_type_id)
    if (job.product_type_id != null) typeIds.add(job.product_type_id)
  }
  const types = typeIds.size > 0 ? await prisma.eveType.findMany({ where: { id: { in: [...typeIds] } }, select: { id: true, name: true } }) : []
  const typeNameById = new Map(types.map((t) => [t.id, t.name]))

  const now = Date.now()
  const jobs: IndustryJob[] = actionableJobs.map(({ characterId, job }) => {
    const endMs = new Date(job.end_date).getTime()
    // Ready to collect only when ESI says so, OR an active job's timer has expired but
    // ESI hasn't flipped it to 'ready' yet. A paused job is never "ready" — its timer
    // is frozen, so a past end_date doesn't mean it finished.
    const ready = job.status === 'ready' || (job.status === 'active' && Number.isFinite(endMs) && endMs <= now)
    return {
      jobId: job.job_id,
      characterId,
      characterName: characterNameById.get(characterId) ?? `Character ${characterId}`,
      activityId: job.activity_id,
      activityName: activityName(job.activity_id),
      productTypeId: job.product_type_id ?? null,
      productName: job.product_type_id != null ? (typeNameById.get(job.product_type_id) ?? `Type ${job.product_type_id}`) : null,
      blueprintTypeId: job.blueprint_type_id,
      blueprintName: typeNameById.get(job.blueprint_type_id) ?? `Type ${job.blueprint_type_id}`,
      runs: job.runs,
      startDate: job.start_date,
      endDate: job.end_date,
      status: job.status,
      ready,
      facilityId: String(job.facility_id),
    }
  })

  jobs.sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())

  const fetchedAt = Date.now()
  // Cache even a partial result (some characters failed) — better than hammering
  // ESI again within the TTL for the characters that DID succeed. `failed` itself
  // is never cached; it's always recomputed from the live attempt.
  await writeCache(userId, { jobs, fetchedAt })

  return { jobs, failed, fetchedAt }
}
