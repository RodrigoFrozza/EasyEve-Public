/**
 * Import EveCategory / EveGroup / EveType from CCP's official Static Data Export (JSONL zip).
 * Uses the OS `unzip -p` binary to read members from the official `.zip` (GNU tar often cannot
 * read ZIP archives with `-xOf`). Streams `types.jsonl` without loading the full file into RAM.
 *
 * @see https://developers.eveonline.com/docs/services/static-data/
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createInterface } from 'node:readline'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

import { prisma } from '@/lib/prisma'

export const OFFICIAL_SDE_JSONL_ZIP_URL =
  'https://developers.eveonline.com/static-data/eve-online-static-data-latest-jsonl.zip'

const USER_AGENT = 'EasyEve/official-sde-import (https://github.com/RodrigoFrozza/EasyEve_)'

const DEFAULT_CACHE_DIR = join(process.cwd(), 'scripts', '.cache', 'sde')

const DEFAULT_ZIP_FILENAME = 'eve-online-static-data-latest.jsonl.zip'

export type OfficialSdeImportOptions = {
  dryRun?: boolean
  /** Batch size for EveType upserts (each batch is one Prisma transaction). */
  typeBatchSize?: number
  /**
   * Optional progress for long imports (e.g. admin ScriptRunner).
   * Phases: `categories_done`, `groups_done`, `types` (every ~2500 lines), `types_batch` (after each DB flush), `finished`.
   */
  onProgress?: (phase: string, data?: Record<string, unknown>) => void | Promise<void>
}

export type OfficialSdeImportStats = {
  categoriesUpserted: number
  groupsUpserted: number
  marketGroupsUpserted: number
  typesUpserted: number
  dryRun: boolean
}

function assertUnzipAvailable(): void {
  try {
    execFileSync('unzip', ['-h'], { stdio: 'ignore' })
  } catch {
    throw new Error(
      'The `unzip` command is required to read the official SDE .zip (e.g. apt-get install -y unzip).'
    )
  }
}

/** Reject HTML error pages or empty files saved as `.zip`. */
export function assertZipLocalFileLooksValid(zipPath: string): void {
  if (!existsSync(zipPath)) {
    throw new Error(`SDE zip not found: ${zipPath}`)
  }
  const buf = readFileSync(zipPath)
  if (buf.length < 4) {
    throw new Error(`SDE zip empty or too small (${buf.length} bytes): ${zipPath}`)
  }
  if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
    throw new Error(
      `Not a ZIP file (missing PK header — often a failed HTTP download saved as HTML): ${zipPath}`
    )
  }
}

/**
 * Resolve the archive member path for a JSONL basename (e.g. `categories.jsonl`).
 * CCP zips usually store names at the archive root; layout can change between builds.
 */
function findZipEntryName(zipPath: string, entryBasename: string): string {
  const r = spawnSync('unzip', ['-l', zipPath], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024
  })
  if (r.status !== 0) {
    throw new Error(`unzip -l failed (exit ${r.status}) for ${zipPath}: ${r.stderr || ''}`)
  }
  const hits: string[] = []
  for (const line of r.stdout.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('Archive:')) continue
    if (t.includes('Length') && t.includes('Name')) continue
    if (/^-{2,}/.test(t)) continue
    const parts = t.split(/\s+/)
    if (parts.length < 4) continue
    const name = parts[parts.length - 1]
    // Require exact basename or directory prefix (avoid e.g. dogmaAttributeCategories.jsonl for categories.jsonl)
    if (name === entryBasename || name.endsWith('/' + entryBasename)) {
      hits.push(name)
    }
  }
  const exact = hits.find((h) => h === entryBasename)
  if (exact) return exact
  if (hits.length === 1) return hits[0]
  if (hits.length > 1) {
    throw new Error(`Ambiguous ${entryBasename} in ${zipPath}: ${hits.join(', ')}`)
  }
  throw new Error(
    `Could not find ${entryBasename} inside ${zipPath}. First lines of unzip -l:\n${r.stdout.split('\n').slice(0, 30).join('\n')}`
  )
}

/** Try basenames in order (CCP has renamed some members, e.g. `market_groups.jsonl` → `marketGroups.jsonl`). */
function findZipEntryNameFirst(zipPath: string, basenames: string[]): string {
  let last: Error | undefined
  for (const b of basenames) {
    try {
      return findZipEntryName(zipPath, b)
    } catch (e) {
      last = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw last ?? new Error(`Could not find any of: ${basenames.join(', ')} in ${zipPath}`)
}

function readUtf8FileFromZip(
  zipPath: string,
  innerPath: string,
  maxBuffer: number = 32 * 1024 * 1024
): string {
  const r = spawnSync('unzip', ['-p', zipPath, innerPath], {
    encoding: 'utf8',
    maxBuffer
  })
  if (r.error) throw r.error
  if (r.status !== 0) {
    throw new Error(
      `unzip -p failed (exit ${r.status}) for ${innerPath} in ${zipPath}: ${(r.stderr || '').toString().trim()}`
    )
  }
  return r.stdout ?? ''
}

function pickEn(field: unknown): string | null {
  if (field == null) return null
  if (typeof field === 'string') return field
  if (typeof field === 'object' && field !== null && 'en' in field) {
    const v = (field as Record<string, unknown>).en
    return typeof v === 'string' ? v : null
  }
  if (typeof field === 'object' && field !== null) {
    for (const v of Object.values(field)) {
      if (typeof v === 'string' && v.length > 0) return v
    }
  }
  return null
}

async function streamLinesFromZip(
  zipPath: string,
  innerPath: string
): Promise<AsyncIterable<string>> {
  const unzip = spawn('unzip', ['-p', zipPath, innerPath], {
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const stderrChunks: Buffer[] = []
  unzip.stderr?.on('data', (c: Buffer) => stderrChunks.push(c))

  const exitCode = new Promise<number>((resolve, reject) => {
    unzip.on('error', reject)
    unzip.on('close', resolve)
  })

  async function* lines(): AsyncGenerator<string, void, undefined> {
    const rl = createInterface({ input: unzip.stdout })
    try {
      for await (const line of rl) {
        if (line.trim().length > 0) yield line
      }
    } finally {
      rl.close()
      const code = await exitCode
      if (code !== 0) {
        const errText = Buffer.concat(stderrChunks).toString('utf8').trim()
        throw new Error(`unzip -p failed (exit ${code}) for ${innerPath}: ${errText}`)
      }
    }
  }

  return lines()
}

export async function downloadOfficialSdeJsonlZip(
  destinationPath: string,
  url: string = OFFICIAL_SDE_JSONL_ZIP_URL
): Promise<void> {
  await mkdir(join(destinationPath, '..'), { recursive: true })
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) {
    throw new Error(`SDE download failed: HTTP ${res.status} ${res.statusText}`)
  }
  if (!res.body) {
    throw new Error('SDE download failed: empty response body')
  }
  await pipeline(Readable.fromWeb(res.body as import('stream/web').ReadableStream), createWriteStream(destinationPath))
}

export function defaultOfficialSdeZipPath(): string {
  return join(DEFAULT_CACHE_DIR, DEFAULT_ZIP_FILENAME)
}

/**
 * Upsert categories and groups from small JSONL files, then stream all types.
 */
export async function importOfficialSdeFromZip(
  zipPath: string,
  options?: OfficialSdeImportOptions
): Promise<OfficialSdeImportStats> {
  assertUnzipAvailable()
  assertZipLocalFileLooksValid(zipPath)
  const categoriesMember = findZipEntryName(zipPath, 'categories.jsonl')
  const groupsMember = findZipEntryName(zipPath, 'groups.jsonl')
  const marketGroupsMember = findZipEntryNameFirst(zipPath, [
    'market_groups.jsonl',
    'marketGroups.jsonl',
  ])
  const typesMember = findZipEntryName(zipPath, 'types.jsonl')

  const dryRun = options?.dryRun === true
  const typeBatchSize = Math.min(200, Math.max(20, options?.typeBatchSize ?? 80))

  let categoriesUpserted = 0
  let groupsUpserted = 0
  let marketGroupsUpserted = 0
  let typesUpserted = 0

  const categoriesText = readUtf8FileFromZip(zipPath, categoriesMember)
  for (const line of categoriesText.split('\n')) {
    if (!line.trim()) continue
    const o = JSON.parse(line) as { _key: number; name: unknown }
    const name = pickEn(o.name) ?? `Category ${o._key}`
    if (!dryRun) {
      await prisma.eveCategory.upsert({
        where: { id: o._key },
        create: { id: o._key, name },
        update: { name }
      })
    }
    categoriesUpserted++
  }
  await options?.onProgress?.('categories_done', { rows: categoriesUpserted })

  const groupsText = readUtf8FileFromZip(zipPath, groupsMember, 64 * 1024 * 1024)
  for (const line of groupsText.split('\n')) {
    if (!line.trim()) continue
    const o = JSON.parse(line) as { _key: number; name: unknown; categoryID: number }
    const name = pickEn(o.name) ?? `Group ${o._key}`
    if (!dryRun) {
      await prisma.eveGroup.upsert({
        where: { id: o._key },
        create: { id: o._key, name, categoryId: o.categoryID },
        update: { name, categoryId: o.categoryID }
      })
    }
    groupsUpserted++
  }
  await options?.onProgress?.('groups_done', { rows: groupsUpserted })

  const marketGroupsText = readUtf8FileFromZip(zipPath, marketGroupsMember, 64 * 1024 * 1024)
  type MarketGroupRow = {
    id: number
    name: string
    description: string | null
    parentGroupId: number | null
  }
  const marketGroupRows: MarketGroupRow[] = []
  for (const line of marketGroupsText.split('\n')) {
    if (!line.trim()) continue
    const o = JSON.parse(line) as {
      _key: number
      marketGroupName?: unknown
      name?: unknown
      description?: unknown
      parentGroupID?: number
      parentGroupId?: number
    }
    const name = pickEn(o.marketGroupName ?? o.name) ?? `Market Group ${o._key}`
    const description = pickEn(o.description)
    const rawParent = o.parentGroupID ?? o.parentGroupId
    const parentGroupId =
      rawParent != null && Number.isFinite(Number(rawParent)) ? Math.floor(Number(rawParent)) : null
    marketGroupRows.push({ id: o._key, name, description, parentGroupId })
  }

  const marketGroupIdSet = new Set(marketGroupRows.map(r => r.id))

  // Two-phase: JSONL order is not parent-before-child; FK requires parent row to exist first.
  for (const r of marketGroupRows) {
    if (!dryRun) {
      await prisma.eveMarketGroup.upsert({
        where: { id: r.id },
        create: {
          id: r.id,
          name: r.name,
          description: r.description,
          parentGroupId: null,
        },
        update: {
          name: r.name,
          description: r.description,
          parentGroupId: null,
        },
      })
    }
    marketGroupsUpserted++
  }

  if (!dryRun) {
    for (const r of marketGroupRows) {
      if (r.parentGroupId == null) continue
      if (!marketGroupIdSet.has(r.parentGroupId)) {
        continue
      }
      await prisma.eveMarketGroup.update({
        where: { id: r.id },
        data: { parentGroupId: r.parentGroupId },
      })
    }
  }

  await options?.onProgress?.('market_groups_done', { rows: marketGroupsUpserted })

  const lineIter = await streamLinesFromZip(zipPath, typesMember)
  let typeLinesSeen = 0
  let batch: {
    id: number
    name: string
    description: string | null
    groupId: number
    raceId: number | null
    factionId: number | null
    marketGroupId: number | null
    volume: number | null
    basePrice: number | null
    iconId: number | null
    published: boolean
  }[] = []

  async function flushTypeBatch(rows: typeof batch): Promise<void> {
    if (rows.length === 0 || dryRun) return
    await prisma.$transaction(
      rows.map((r) =>
        prisma.eveType.upsert({
          where: { id: r.id },
          create: r,
          update: {
            name: r.name,
            description: r.description,
            groupId: r.groupId,
            raceId: r.raceId,
            factionId: r.factionId,
            marketGroupId: r.marketGroupId,
            volume: r.volume,
            basePrice: r.basePrice,
            iconId: r.iconId,
            published: r.published
          }
        })
      )
    )
    await options?.onProgress?.('types_batch', {
      typesSeen: typeLinesSeen,
      batchUpserted: rows.length
    })
  }

  for await (const line of lineIter) {
    const o = JSON.parse(line) as Record<string, unknown> & {
      _key: number
      groupID: number
      marketGroupID?: number
    }
    const id = o._key
    const groupId = typeof o.groupID === 'number' ? o.groupID : Number(o.groupID)
    if (!Number.isFinite(id) || !Number.isFinite(groupId)) continue

    const name = pickEn(o.name)?.trim() || `Type ${id}`
    const descRaw = pickEn(o.description)
    const description = descRaw && descRaw.length > 0 ? descRaw : null

    const volume = typeof o.volume === 'number' ? o.volume : o.volume != null ? Number(o.volume) : null
    const basePrice =
      typeof o.basePrice === 'number' ? o.basePrice : o.basePrice != null ? Number(o.basePrice) : null
    const iconRaw = o.iconID
    const iconId =
      typeof iconRaw === 'number'
        ? iconRaw
        : iconRaw != null && !Number.isNaN(Number(iconRaw))
          ? Math.floor(Number(iconRaw))
          : null
    const raceRaw = o.raceID
    const raceId =
      typeof raceRaw === 'number'
        ? Math.floor(raceRaw)
        : raceRaw != null && !Number.isNaN(Number(raceRaw))
          ? Math.floor(Number(raceRaw))
          : null
    const factionRaw = o.factionID
    const factionId =
      typeof factionRaw === 'number'
        ? Math.floor(factionRaw)
        : factionRaw != null && !Number.isNaN(Number(factionRaw))
          ? Math.floor(Number(factionRaw))
          : null
    const marketGroupId =
      typeof o.marketGroupID === 'number'
        ? o.marketGroupID
        : o.marketGroupID != null && !Number.isNaN(Number(o.marketGroupID))
          ? Math.floor(Number(o.marketGroupID))
          : null
    const published = o.published === true

    typeLinesSeen++
    if (typeLinesSeen > 0 && typeLinesSeen % 2500 === 0) {
      await options?.onProgress?.('types', { typesSeen: typeLinesSeen })
    }

    batch.push({
      id,
      name,
      description,
      groupId,
      raceId,
      factionId,
      marketGroupId,
      volume: volume != null && Number.isFinite(volume) ? volume : null,
      basePrice: basePrice != null && Number.isFinite(basePrice) ? basePrice : null,
      iconId,
      published
    })

    if (batch.length >= typeBatchSize) {
      await flushTypeBatch(batch)
      batch = []
    }
  }

  await flushTypeBatch(batch)

  typesUpserted = typeLinesSeen

  await options?.onProgress?.('finished', {
    categoriesUpserted,
    groupsUpserted,
    marketGroupsUpserted,
    typesUpserted,
    dryRun
  })

  return { categoriesUpserted, groupsUpserted, marketGroupsUpserted, typesUpserted, dryRun }
}
