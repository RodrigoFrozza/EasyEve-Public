import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { getValidAccessToken } from '@/lib/token-manager'
import { withEsiRetry } from '@/lib/esi-retry'
import { logger } from '@/lib/server-logger'

/**
 * Sync a character's owned blueprints from ESI into CharacterBlueprint, so the
 * Industry cost calculator can offer the user's real ME/TE instead of an assumed
 * default (the trust model EVE IPH uses, instead of guessing max ME).
 *
 * ESI field semantics confirmed against https://esi.evetech.net/latest/swagger.json
 * (GET /characters/{character_id}/blueprints/), checked 2026-07-16:
 *   - Auth: requires esi-characters.read_blueprints.v1 (already requested at login).
 *   - Pagination: standard `page` query param + `x-pages` response header, up to
 *     1000 items per page (same pattern as src/lib/pi/structure-market.ts).
 *   - `quantity` (int32, "a range of numbers with a minimum of -2 and no maximum
 *     value where -1 is an original and -2 is a copy"). No other value is
 *     documented by the spec. We derive `isCopy` from this field at sync time
 *     (see deriveIsCopy below) — any value outside {-1, -2} is unexpected per the
 *     spec and is logged + conservatively treated as a copy rather than silently
 *     misclassified as an original (a BPC that's mistaken for a BPO would look
 *     like an infinite-run item; the reverse mistake is the safer direction).
 *   - `runs` (int32, min -1): "-1 if original", otherwise "number of runs
 *     remaining if blueprint is a copy".
 *   - `material_efficiency`: documented range 0-25. `time_efficiency`: 0-20.
 *   - `item_id` / `location_id`: ESI int64 — stored as Postgres BIGINT (Prisma
 *     BigInt). Like every other ESI numeric id in this codebase, these pass
 *     through axios's JSON.parse first, so an id beyond 2^53 would already have
 *     lost precision before we see it; this is an inherent JSON limitation, not
 *     specific to this sync.
 */

const LOG_TAG = 'INDUSTRY_BP_SYNC'
const MAX_PAGES = 20
const DEFAULT_MAX_AGE_MS = 60 * 60 * 1000 // 60 min

// Freshness markers live in SdeCache, NOT in the CharacterBlueprint rows: a character
// who owns zero blueprints has zero rows, so a row-based freshness check would re-hit
// ESI for that character on every blueprint-cost call, forever (most alts own no
// blueprints). The marker records "we successfully synced at T" independently of how
// many blueprints came back. Same SdeCache style as the structure-access cache in
// src/lib/pi/structure-market.ts.
const SYNC_MARKER_PREFIX = 'industry_bp_sync_'
const SYNC_MARKER_TTL_MS = 24 * 60 * 60 * 1000 // 24h

function syncMarkerKey(characterId: number): string {
  return `${SYNC_MARKER_PREFIX}${characterId}`
}

async function setSyncMarker(characterId: number, syncedAtMs: number): Promise<void> {
  const key = syncMarkerKey(characterId)
  const value = { syncedAt: syncedAtMs }
  await prisma.sdeCache.upsert({
    where: { key },
    create: { key, value: value as any, expiresAt: new Date(syncedAtMs + SYNC_MARKER_TTL_MS) },
    update: { value: value as any, expiresAt: new Date(syncedAtMs + SYNC_MARKER_TTL_MS) },
  })
}

/** Batched read of every character's sync marker — one query for the whole roster. */
async function getSyncMarkers(characterIds: number[]): Promise<Map<number, number>> {
  if (characterIds.length === 0) return new Map()
  const entries = await prisma.sdeCache.findMany({
    where: { key: { in: characterIds.map(syncMarkerKey) } },
  })
  const markers = new Map<number, number>()
  for (const entry of entries) {
    const characterId = parseInt(entry.key.replace(SYNC_MARKER_PREFIX, ''), 10)
    const syncedAt = (entry.value as unknown as { syncedAt?: number })?.syncedAt
    if (Number.isFinite(characterId) && typeof syncedAt === 'number') markers.set(characterId, syncedAt)
  }
  return markers
}

interface EsiBlueprint {
  item_id: number
  type_id: number
  location_id: number
  location_flag: string
  quantity: number
  runs: number
  time_efficiency: number
  material_efficiency: number
}

/**
 * Per ESI's documented sentinel: -1 = original (BPO), -2 = copy (BPC). Any other
 * value isn't documented — surface it loudly and default to the conservative
 * classification (copy) instead of guessing it's an infinite-run original.
 */
function deriveIsCopy(quantity: number, itemId: number, typeId: number): boolean {
  if (quantity === -1) return false
  if (quantity === -2) return true
  logger.warn(
    LOG_TAG,
    `Unexpected blueprint quantity sentinel ${quantity} for item ${itemId} (type ${typeId}) — ESI docs only define -1 (original) / -2 (copy); treating as a copy`
  )
  return true
}

async function fetchBlueprintsPage(
  characterId: number,
  page: number,
  accessToken: string
): Promise<{ data: EsiBlueprint[]; totalPages: number }> {
  return withEsiRetry(async () => {
    const res = await esiClient.get(`/characters/${characterId}/blueprints/`, {
      params: { page },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = Array.isArray(res.data) ? (res.data as EsiBlueprint[]) : []
    const totalPages = parseInt(String(res.headers['x-pages'] ?? '1'), 10) || 1
    return { data, totalPages }
  })
}

async function fetchAllBlueprints(characterId: number, accessToken: string): Promise<EsiBlueprint[]> {
  const all: EsiBlueprint[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= MAX_PAGES) {
    const { data, totalPages: pages } = await fetchBlueprintsPage(characterId, page, accessToken)
    totalPages = pages
    all.push(...data)
    if (data.length === 0) break
    page += 1
  }
  return all
}

/**
 * Sync one character's owned blueprints. Replace-all, not merge: blueprints move,
 * get researched, or get sold constantly, so a partial upsert would leave stale
 * rows looking like still-owned blueprints. The delete+insert only happens AFTER
 * the full paginated ESI fetch has succeeded, and both run in a single transaction
 * — a failure partway through fetching must never wipe existing rows without
 * replacing them.
 */
export async function syncCharacterBlueprints(
  characterId: number
): Promise<{ synced: number } | { error: string }> {
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) {
    return { error: `No access token for character ${characterId}` }
  }

  let raw: EsiBlueprint[]
  try {
    raw = await fetchAllBlueprints(characterId, accessToken)
  } catch (error) {
    logger.warn(LOG_TAG, `Blueprint fetch failed for character ${characterId}`, error)
    return { error: error instanceof Error ? error.message : 'ESI fetch failed' }
  }

  const rows = raw.map((bp) => ({
    characterId,
    itemId: BigInt(bp.item_id),
    typeId: bp.type_id,
    locationId: BigInt(bp.location_id),
    materialEfficiency: bp.material_efficiency,
    timeEfficiency: bp.time_efficiency,
    runs: bp.runs,
    quantity: bp.quantity,
    isCopy: deriveIsCopy(bp.quantity, bp.item_id, bp.type_id),
    syncedAt: new Date(),
  }))

  await prisma.$transaction([
    prisma.characterBlueprint.deleteMany({ where: { characterId } }),
    prisma.characterBlueprint.createMany({ data: rows }),
  ])

  // Record the successful sync even when the character owns zero blueprints —
  // without this, a rowless character would look "never synced" and get re-fetched
  // from ESI on every blueprint-cost call.
  await setSyncMarker(characterId, Date.now())

  return { synced: rows.length }
}

export interface SyncUserBlueprintsResult {
  characters: number
  synced: number
  failed: number[]
  lastSyncedAt: Date | null
}

/**
 * Sync every character of the user whose blueprint data is older than
 * `maxAgeMs` (default 60 min). Freshness comes from the per-character SdeCache
 * sync markers (ONE batched query for the whole roster), not from the
 * CharacterBlueprint rows — a character who owns zero blueprints has zero rows
 * but is still fresh after a successful sync. No marker → sync.
 * A single character's ESI failure is collected in `failed` and never aborts the
 * others (degrade per-item, per CLAUDE.md — one alt's failure can't hide the
 * whole roster's blueprints).
 */
export async function syncUserBlueprints(
  userId: string,
  opts?: { maxAgeMs?: number }
): Promise<SyncUserBlueprintsResult> {
  const maxAgeMs = opts?.maxAgeMs ?? DEFAULT_MAX_AGE_MS
  const now = Date.now()

  const characters = await prisma.character.findMany({
    where: { userId },
    select: { id: true },
  })

  const markers = await getSyncMarkers(characters.map((c) => c.id))

  const failed: number[] = []
  let synced = 0
  let lastSyncedAtMs: number | null = null

  for (const { id: characterId } of characters) {
    const markerMs = markers.get(characterId)
    if (markerMs != null && now - markerMs < maxAgeMs) {
      if (lastSyncedAtMs == null || markerMs > lastSyncedAtMs) lastSyncedAtMs = markerMs
      continue
    }

    const result = await syncCharacterBlueprints(characterId)
    if ('error' in result) {
      logger.warn(LOG_TAG, `Blueprint sync failed for character ${characterId}: ${result.error}`)
      failed.push(characterId)
      continue
    }
    synced += result.synced
    lastSyncedAtMs = Date.now()
  }

  return {
    characters: characters.length,
    synced,
    failed,
    lastSyncedAt: lastSyncedAtMs != null ? new Date(lastSyncedAtMs) : null,
  }
}

export interface OwnedBlueprintRow {
  characterId: number
  characterName: string
  materialEfficiency: number
  timeEfficiency: number
  runs: number
  isCopy: boolean
}

/**
 * All of a user's characters' owned blueprints for a given blueprint TYPE (not
 * product type — callers pass Blueprint.blueprintTypeId), ordered by material
 * efficiency descending so the best owned copy/original surfaces first.
 */
export async function getOwnedBlueprints(userId: string, typeId: number): Promise<OwnedBlueprintRow[]> {
  const rows = await prisma.characterBlueprint.findMany({
    where: { typeId, character: { userId } },
    include: { character: { select: { name: true } } },
    orderBy: { materialEfficiency: 'desc' },
  })

  return rows.map((r) => ({
    characterId: r.characterId,
    characterName: r.character.name,
    materialEfficiency: r.materialEfficiency,
    timeEfficiency: r.timeEfficiency,
    runs: r.runs,
    isCopy: r.isCopy,
  }))
}
