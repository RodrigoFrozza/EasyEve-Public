import { prisma } from '@/lib/prisma'
import { esiClient } from '@/lib/esi-client'
import { getValidAccessToken } from '@/lib/token-manager'
import { logger } from '@/lib/server-logger'
import { withEsiRetry } from '@/lib/esi-retry'
import type { MarketDepth, MarketDepthLevel } from '@/lib/market-prices'

const STRUCT_DEPTH_TTL = 20 * 60 * 1000 // 20 min
const STRUCT_DEPTH_KEY_PREFIX = 'pi_struct_depth_'
const MAX_PAGES = 30
const MAX_DEPTH_LEVELS = 100
// If live ESI fetches keep failing (lost docking access, structure unreachable), the
// cache fallback below used to serve arbitrarily old data forever with no signal that
// it wasn't current — a real incident (2026-07) where a Shopping List secondary hub
// quietly showed a days-old order book as if live. Beyond this bound, drop the entry
// instead of lying with a number that might no longer exist; the caller falls back to
// region/Jita. (`shopping-prices.ts` also flags anything older than one refresh cycle
// as `stale` in the UI — this cap is the last resort for fetches down far longer.)
const STRUCT_DEPTH_MAX_FALLBACK_AGE_MS = 24 * 60 * 60 * 1000 // 24h

// Docking access to a structure rarely changes — remember which character
// worked last time so we don't re-walk the whole roster (up to 15 sequential
// ESI round-trips) on every cache miss. Falls back to the full search if the
// remembered character loses access.
const STRUCT_ACCESS_CHAR_PREFIX = 'pi_struct_access_char_'
const STRUCT_ACCESS_TTL = 24 * 60 * 60 * 1000 // 24h

async function getCachedAccessCharacter(structureId: string): Promise<number | null> {
  const entry = await prisma.sdeCache.findUnique({
    where: { key: `${STRUCT_ACCESS_CHAR_PREFIX}${structureId}` },
  })
  if (!entry) return null
  const value = entry.value as unknown as { characterId: number; cachedAt: number }
  if (!value?.characterId || Date.now() - value.cachedAt > STRUCT_ACCESS_TTL) return null
  return value.characterId
}

async function setCachedAccessCharacter(structureId: string, characterId: number): Promise<void> {
  const key = `${STRUCT_ACCESS_CHAR_PREFIX}${structureId}`
  const value = { characterId, cachedAt: Date.now() }
  await prisma.sdeCache.upsert({
    where: { key },
    create: { key, value: value as any, expiresAt: new Date(Date.now() + STRUCT_ACCESS_TTL) },
    update: { value: value as any, expiresAt: new Date(Date.now() + STRUCT_ACCESS_TTL) },
  })
}

/** Try the last-known-good character first, then the rest of the roster. */
function orderCharactersByLastKnownAccess(
  characterIds: number[],
  cachedCharacterId: number | null
): number[] {
  if (cachedCharacterId == null || !characterIds.includes(cachedCharacterId)) return characterIds
  return [cachedCharacterId, ...characterIds.filter((id) => id !== cachedCharacterId)]
}

interface StructureOrder {
  type_id: number
  is_buy_order: boolean
  price: number
  volume_remain: number
  volume_total?: number
  location_id?: number
  order_id?: number
  duration?: number
  range?: string
  escrow?: number
  issued?: string
}

/**
 * A large structure's order book can span dozens of pages; one transient blip
 * on any single page used to discard every page already fetched, silently
 * falling back to region/Jita pricing for that request only — the next
 * request would then succeed and jump back to the (very different) structure
 * price, looking like the numbers were "random". Retrying a failed page a
 * couple of times before giving up smooths that out.
 */
async function fetchStructurePage(
  structureId: string,
  page: number,
  accessToken: string
): Promise<{ data: StructureOrder[]; totalPages: number }> {
  return withEsiRetry(async () => {
    const res = await esiClient.get(`/markets/structures/${structureId}/`, {
      params: { page },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = Array.isArray(res.data) ? (res.data as StructureOrder[]) : []
    const totalPages = parseInt(String(res.headers['x-pages'] ?? '1'), 10) || 1
    return { data, totalPages }
  })
}

/**
 * Fetch every order in a private structure's market (one paginated call set — the
 * endpoint returns all types at once). Requires a character with docking/market
 * access and the esi-markets.structure_markets.v1 scope. A 403 (no access) throws
 * so the caller can fall back to the region market.
 */
async function fetchAllStructureOrders(
  structureId: string,
  characterId: number
): Promise<StructureOrder[]> {
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) {
    throw new Error(`No access token for character ${characterId}`)
  }

  const all: StructureOrder[] = []
  let page = 1
  let totalPages = 1
  while (page <= totalPages && page <= MAX_PAGES) {
    const { data, totalPages: pages } = await fetchStructurePage(structureId, page, accessToken)
    totalPages = pages
    all.push(...data)
    if (data.length === 0) break
    page += 1
  }
  return all
}

function buildDepthByType(orders: StructureOrder[], now: number): Map<number, MarketDepth> {
  const byType = new Map<number, { sell: MarketDepthLevel[]; buy: MarketDepthLevel[] }>()
  for (const o of orders) {
    if (!(o.price > 0) || !(o.volume_remain > 0)) continue
    const entry = byType.get(o.type_id) ?? { sell: [], buy: [] }
    const level: MarketDepthLevel = {
      price: o.price,
      volume: Number(o.volume_remain),
      locationId: o.location_id ?? 0,
    }
    if (o.is_buy_order) entry.buy.push(level)
    else entry.sell.push(level)
    byType.set(o.type_id, entry)
  }

  const result = new Map<number, MarketDepth>()
  for (const [typeId, { sell, buy }] of byType) {
    result.set(typeId, {
      sell: sell.sort((a, b) => a.price - b.price).slice(0, MAX_DEPTH_LEVELS),
      buy: buy.sort((a, b) => b.price - a.price).slice(0, MAX_DEPTH_LEVELS),
      updatedAt: now,
    })
  }
  return result
}

const MAX_DEPTH_CHARACTERS = 15

/**
 * Per-type order-book depth for a private structure market, cached in Postgres
 * (20 min, fallback to last known on error). Same shape as getRegionalMarketDepth
 * so callers can treat structure and region depth interchangeably.
 *
 * Docking/market access to a private structure is per-character, so a single
 * "first" character may not have it — try each of the user's characters in turn
 * until one succeeds (mirrors searchStructures). Returns {} on total failure so
 * pricing falls back to region/Jita.
 */
export async function getStructureMarketDepth(
  structureId: string,
  characterIds: number[],
  typeIds: number[]
): Promise<Record<number, MarketDepth>> {
  const now = Date.now()
  const uniqueIds = Array.from(new Set(typeIds))
  const results: Record<number, MarketDepth> = {}
  if (uniqueIds.length === 0 || !structureId || characterIds.length === 0) return results

  const keyFor = (id: number) => `${STRUCT_DEPTH_KEY_PREFIX}${structureId}_${id}`
  const cachedEntries = await prisma.sdeCache.findMany({
    where: { key: { in: uniqueIds.map(keyFor) } },
  })
  const cacheMap = new Map<number, MarketDepth>()
  for (const entry of cachedEntries) {
    const typeId = parseInt(entry.key.replace(`${STRUCT_DEPTH_KEY_PREFIX}${structureId}_`, ''), 10)
    if (Number.isFinite(typeId)) cacheMap.set(typeId, entry.value as unknown as MarketDepth)
  }

  const missing: number[] = []
  for (const id of uniqueIds) {
    const cached = cacheMap.get(id)
    if (cached && now - cached.updatedAt < STRUCT_DEPTH_TTL) results[id] = cached
    else missing.push(id)
  }
  if (missing.length === 0) return results

  let orders: StructureOrder[] | null = null
  let lastError: unknown
  const cachedCharacterId = await getCachedAccessCharacter(structureId)
  const ordered = orderCharactersByLastKnownAccess(characterIds, cachedCharacterId)
  for (const characterId of ordered.slice(0, MAX_DEPTH_CHARACTERS)) {
    try {
      orders = await fetchAllStructureOrders(structureId, characterId)
      if (characterId !== cachedCharacterId) await setCachedAccessCharacter(structureId, characterId)
      break
    } catch (error) {
      lastError = error
    }
  }

  if (orders == null) {
    logger.warn(
      'PI_STRUCT_MARKET',
      `Structure ${structureId} market fetch failed for all ${Math.min(characterIds.length, MAX_DEPTH_CHARACTERS)} tried characters`,
      lastError
    )
    // Serve expired cache while it's recent enough to still be useful (the UI flags it
    // as stale); once it's older than STRUCT_DEPTH_MAX_FALLBACK_AGE_MS, drop it instead
    // so the caller falls back to the region/Jita market rather than trusting a
    // days-old snapshot.
    for (const id of missing) {
      const cached = cacheMap.get(id)
      if (cached && now - cached.updatedAt <= STRUCT_DEPTH_MAX_FALLBACK_AGE_MS) results[id] = cached
    }
    return results
  }

  const depthByType = buildDepthByType(orders, now)
  for (const id of missing) {
    const depth = depthByType.get(id) ?? { sell: [], buy: [], updatedAt: now }
    results[id] = depth
    await prisma.sdeCache.upsert({
      where: { key: keyFor(id) },
      create: { key: keyFor(id), value: depth as any, expiresAt: new Date(now + STRUCT_DEPTH_TTL) },
      update: { value: depth as any, expiresAt: new Date(now + STRUCT_DEPTH_TTL) },
    })
  }

  return results
}

export interface StructureOrderRow {
  is_buy_order: boolean
  price: number
  volume_remain: number
  volume_total: number
  location_id: number
  order_id: number
  duration: number
  range: string
  escrow: number
  issued: string
}

const MAX_ORDER_CHARACTERS = 15

/**
 * Raw sell/buy orders for a single type in a private structure market —
 * unlike `getStructureMarketDepth` (aggregated, no order_id), this keeps the
 * per-order shape the Market Browser's order table needs. Not cached: the
 * per-type depth cache already covers the "is this worth a fresh ESI call"
 * question elsewhere; this is a direct, on-demand lookup for a single item a
 * user is actively looking at.
 */
export async function getStructureOrdersForType(
  structureId: string,
  characterIds: number[],
  typeId: number
): Promise<StructureOrderRow[] | null> {
  if (!structureId || characterIds.length === 0) return null

  let orders: StructureOrder[] | null = null
  let lastError: unknown
  const cachedCharacterId = await getCachedAccessCharacter(structureId)
  const ordered = orderCharactersByLastKnownAccess(characterIds, cachedCharacterId)
  for (const characterId of ordered.slice(0, MAX_ORDER_CHARACTERS)) {
    try {
      orders = await fetchAllStructureOrders(structureId, characterId)
      if (characterId !== cachedCharacterId) await setCachedAccessCharacter(structureId, characterId)
      break
    } catch (error) {
      lastError = error
    }
  }

  if (orders == null) {
    logger.warn(
      'PI_STRUCT_MARKET',
      `Structure ${structureId} order fetch failed for all ${Math.min(characterIds.length, MAX_ORDER_CHARACTERS)} tried characters`,
      lastError
    )
    return null
  }

  return orders
    .filter((o) => o.type_id === typeId)
    .map((o) => ({
      is_buy_order: o.is_buy_order,
      price: o.price,
      volume_remain: o.volume_remain,
      volume_total: o.volume_total ?? o.volume_remain,
      location_id: Number(structureId),
      order_id: o.order_id ?? 0,
      duration: o.duration ?? 0,
      range: o.range ?? 'station',
      escrow: o.escrow ?? 0,
      issued: o.issued ?? '',
    }))
}

export interface StationOrder {
  type_id: number
  is_buy_order: boolean
  price: number
  volume_remain: number
}

/**
 * Every order in a private structure's market (all types), for the "what to
 * produce" deficit scanner. Same per-character access dance as
 * getStructureOrdersForType, but returns the whole book unfiltered so the caller
 * can aggregate supply/demand across items. Null on total access failure.
 */
export async function getAllStructureOrders(
  structureId: string,
  characterIds: number[]
): Promise<StationOrder[] | null> {
  if (!structureId || characterIds.length === 0) return null

  let orders: StructureOrder[] | null = null
  let lastError: unknown
  const cachedCharacterId = await getCachedAccessCharacter(structureId)
  const ordered = orderCharactersByLastKnownAccess(characterIds, cachedCharacterId)
  for (const characterId of ordered.slice(0, MAX_ORDER_CHARACTERS)) {
    try {
      orders = await fetchAllStructureOrders(structureId, characterId)
      if (characterId !== cachedCharacterId) await setCachedAccessCharacter(structureId, characterId)
      break
    } catch (error) {
      lastError = error
    }
  }

  if (orders == null) {
    logger.warn(
      'PI_STRUCT_MARKET',
      `Structure ${structureId} full-order fetch failed for all tried characters`,
      lastError
    )
    return null
  }

  return orders.map((o) => ({
    type_id: o.type_id,
    is_buy_order: o.is_buy_order,
    price: o.price,
    volume_remain: o.volume_remain,
  }))
}

/**
 * Cheap "does this structure have an active market?" check — fetches only the
 * first page of its order book (not the whole thing) and returns whether it has
 * any orders. Used to filter the monitored-station picker to structures that
 * actually trade. Returns false on no access / no market service / empty book.
 */
export async function structureHasMarket(
  structureId: string,
  characterIds: number[]
): Promise<boolean> {
  if (!structureId || characterIds.length === 0) return false

  const cachedCharacterId = await getCachedAccessCharacter(structureId)
  const ordered = orderCharactersByLastKnownAccess(characterIds, cachedCharacterId)
  for (const characterId of ordered.slice(0, MAX_ORDER_CHARACTERS)) {
    try {
      const { accessToken } = await getValidAccessToken(characterId)
      if (!accessToken) continue
      const { data } = await fetchStructurePage(structureId, 1, accessToken)
      if (characterId !== cachedCharacterId) await setCachedAccessCharacter(structureId, characterId)
      return data.length > 0
    } catch {
      // No access via this character (403) or transient error — try the next.
    }
  }
  return false
}

/**
 * `yes` = tem mercado com ordens · `no` = acessível mas sem mercado/ordens, ou
 * acesso negado de forma definitiva · `unknown` = **a ESI não respondeu**.
 *
 * A distinção entre `no` e `unknown` é a regra de ouro aplicada aqui: esconder
 * uma estação porque a ESI teve um soluço é o mesmo erro de engolir um erro e
 * devolver default. `no` a gente esconde; `unknown` a gente mostra com ressalva.
 */
export type StructureMarketProbe = 'yes' | 'no' | 'unknown'

/** 403/404 = resposta definitiva da ESI (sem acesso ao mercado / sem mercado). */
function isDefinitiveDenial(error: unknown): boolean {
  const status = (error as { response?: { status?: number } })?.response?.status
  return status === 403 || status === 404
}

/**
 * "Esta estrutura tem mercado?" — versão que distingue ausência de falha.
 *
 * Difere de `structureHasMarket`, que devolve `false` nos dois casos (mantida
 * como está: outros chamadores dependem do booleano). Busca só a 1ª página do
 * book, não o livro inteiro.
 */
export async function probeStructureMarket(
  structureId: string,
  characterIds: number[]
): Promise<StructureMarketProbe> {
  if (!structureId || characterIds.length === 0) return 'unknown'

  const cachedCharacterId = await getCachedAccessCharacter(structureId)
  const ordered = orderCharactersByLastKnownAccess(characterIds, cachedCharacterId)
  let sawTransientError = false
  let sawDefinitiveDenial = false

  for (const characterId of ordered.slice(0, MAX_ORDER_CHARACTERS)) {
    try {
      const { accessToken } = await getValidAccessToken(characterId)
      if (!accessToken) continue
      const { data } = await fetchStructurePage(structureId, 1, accessToken)
      if (characterId !== cachedCharacterId) await setCachedAccessCharacter(structureId, characterId)
      return data.length > 0 ? 'yes' : 'no'
    } catch (error) {
      if (isDefinitiveDenial(error)) sawDefinitiveDenial = true
      else sawTransientError = true
    }
  }

  // Um erro transitório em qualquer personagem já basta para NÃO afirmar que não
  // há mercado — `fetchStructurePage` já reexecuta antes de estourar, então
  // chegar aqui significa que a ESI realmente não respondeu.
  if (sawTransientError) return 'unknown'
  if (sawDefinitiveDenial) return 'no'
  return 'unknown'
}

export interface StructureSearchResult {
  structureId: string
  name: string
}

/**
 * Search structures a single character can see by name (ESI character search).
 * ESI's structure search/detail endpoints only return structures the querying
 * character has "docking knowledge" of (docked there, bookmarked, or same
 * corp/alliance as the owner) — a character with no relation to the structure
 * gets an empty result even though the structure exists.
 */
async function searchStructuresForCharacter(
  characterId: number,
  query: string
): Promise<StructureSearchResult[]> {
  const { accessToken } = await getValidAccessToken(characterId)
  if (!accessToken) return []

  try {
    const res = await esiClient.get(`/characters/${characterId}/search/`, {
      params: { categories: 'structure', search: query, strict: false },
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const ids: number[] = Array.isArray(res.data?.structure) ? res.data.structure.slice(0, 20) : []
    if (ids.length === 0) return []

    const results = await Promise.all(
      ids.map(async (id) => {
        try {
          const info = await esiClient.get(`/universe/structures/${id}/`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          return { structureId: String(id), name: info.data?.name ?? `Structure ${id}` }
        } catch (err) {
          logger.debug('PI_STRUCT_MARKET', `Failed to fetch structure ${id} details (char ${characterId})`, err)
          return null
        }
      })
    )
    return results.filter((r): r is StructureSearchResult => r != null)
  } catch (error) {
    logger.warn('PI_STRUCT_MARKET', `Structure search failed for ${characterId} (query="${query}")`, error)
    return []
  }
}

const MAX_SEARCH_CHARACTERS = 15

/**
 * Search structures by name, trying each of the user's characters in turn until
 * one returns a hit. A single "first" character is not reliable — docking
 * access to a private structure is per-character, so the character with access
 * may be any of the user's alts, not necessarily the first one in the account.
 */
export async function searchStructures(
  characterIds: number[],
  query: string
): Promise<StructureSearchResult[]> {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  for (const characterId of characterIds.slice(0, MAX_SEARCH_CHARACTERS)) {
    const results = await searchStructuresForCharacter(characterId, trimmed)
    if (results.length > 0) {
      // Remember this character for the structure(s) just found, so a later
      // getStructureMarketDepth call for the same structure skips the search.
      await Promise.all(
        results.map((r) => setCachedAccessCharacter(r.structureId, characterId))
      )
      return results
    }
  }
  logger.info(
    'PI_STRUCT_MARKET',
    `No character found with docking knowledge of "${trimmed}" (tried ${Math.min(characterIds.length, MAX_SEARCH_CHARACTERS)} characters)`
  )
  return []
}
