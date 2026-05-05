/**
 * Shared external type identity fallbacks (EVE Ref, Adam4EVE) for SDE/ESI sync paths.
 * Used by ship dogma sync and module metadata resolution.
 */

export type IdentitySource = 'esi' | 'sde' | 'everef' | 'adam4eve' | 'unknown'

export type EverefTypeIdentity = {
  race_id?: number | null
  faction_id?: number | null
  group_id?: number | null
}

export type Adam4EveTypeIdentity = {
  group_id?: number | null
  category_id?: number | null
}

const CACHE_TTL = 60 * 60 * 1000 // 1 hour
const everefTypeCache = new Map<number, { data: EverefTypeIdentity | null; timestamp: number }>()
const adam4eveTypeCache = new Map<number, { data: Adam4EveTypeIdentity | null; timestamp: number }>()

export function asNullableInt(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.floor(value)
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return Math.floor(parsed)
  }
  return null
}

export async function fetchEverefTypeIdentity(typeId: number): Promise<EverefTypeIdentity | null> {
  const cached = everefTypeCache.get(typeId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const response = await fetch(`https://ref-data.everef.net/types/${typeId}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EasyEve/type-fallback' },
    })
    if (!response.ok) {
      everefTypeCache.set(typeId, { data: null, timestamp: Date.now() })
      return null
    }
    const json = (await response.json()) as Record<string, unknown>
    const data: EverefTypeIdentity = {
      race_id: asNullableInt(json.race_id),
      faction_id: asNullableInt(json.faction_id),
      group_id: asNullableInt(json.group_id),
    }
    everefTypeCache.set(typeId, { data, timestamp: Date.now() })
    return data
  } catch {
    everefTypeCache.set(typeId, { data: null, timestamp: Date.now() })
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchAdam4EveTypeIdentity(typeId: number): Promise<Adam4EveTypeIdentity | null> {
  const cached = adam4eveTypeCache.get(typeId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(`https://www.adam4eve.eu/commodity.php?typeID=${typeId}`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'EasyEve/type-fallback' },
    })
    if (!response.ok) {
      adam4eveTypeCache.set(typeId, { data: null, timestamp: Date.now() })
      return null
    }
    const html = await response.text()
    const groupMatch = html.match(/groupID=(\d+)/i)
    const catMatch = html.match(/catID=(\d+)/i)
    const data: Adam4EveTypeIdentity = {
      group_id: groupMatch ? Number(groupMatch[1]) : null,
      category_id: catMatch ? Number(catMatch[1]) : null,
    }
    adam4eveTypeCache.set(typeId, { data, timestamp: Date.now() })
    return data
  } catch {
    adam4eveTypeCache.set(typeId, { data: null, timestamp: Date.now() })
    return null
  } finally {
    clearTimeout(timeout)
  }
}
