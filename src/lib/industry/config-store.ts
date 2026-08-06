import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { REGIONS } from '@/lib/constants/market'
import type {
  HubKind,
  IndustryHub,
  IndustryConfigData,
  FactoryConfig,
  StructureSecurity,
} from '@/lib/industry/config-types'

export type { HubKind, IndustryHub, IndustryConfigData } from '@/lib/industry/config-types'

/** The NPC trade hubs offered in the picker (from the verified REGIONS list). */
export const NPC_HUBS: IndustryHub[] = REGIONS.map((r) => ({
  kind: 'region' as const,
  id: String(r.id),
  name: `${r.hub} (${r.name})`,
}))

const JITA_HUB: IndustryHub = NPC_HUBS.find((h) => h.id === '10000002') ?? NPC_HUBS[0]!

/** Sensible default before the user configures anything: buy + sell at Jita. */
export function defaultIndustryConfig(): IndustryConfigData {
  return {
    buyHubs: [JITA_HUB],
    sellHub: JITA_HUB,
    defaultMe: 0,
    factory: null,
    monitoredStations: [],
    salesTaxPct: null,
    brokerFeePct: null,
    industryCharacterId: null,
  }
}

function parseCharacterId(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null
}

function parseHub(value: unknown): IndustryHub | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  const kind = o.kind === 'structure' ? 'structure' : o.kind === 'region' ? 'region' : null
  if (!kind || typeof o.id !== 'string' || typeof o.name !== 'string') return null
  return { kind, id: o.id, name: o.name }
}

/** Exported for the snapshot-collection admin script, which reads monitoredStations
 * directly off every user's IndustryConfig row rather than through loadIndustryConfig. */
export function parseHubs(value: unknown): IndustryHub[] {
  if (!Array.isArray(value)) return []
  return value.map(parseHub).filter((h): h is IndustryHub => h != null)
}

const SECURITIES: StructureSecurity[] = ['HIGH_SEC', 'LOW_SEC', 'NULL_SEC']

function parseFactory(value: unknown): FactoryConfig | null {
  if (!value || typeof value !== 'object') return null
  const o = value as Record<string, unknown>
  const security = SECURITIES.includes(o.security as StructureSecurity)
    ? (o.security as StructureSecurity)
    : 'HIGH_SEC'
  const rigs = Array.isArray(o.rigs)
    ? o.rigs
        .map((r) => {
          if (!r || typeof r !== 'object') return null
          const ro = r as Record<string, unknown>
          return typeof ro.typeId === 'number' && typeof ro.name === 'string'
            ? { typeId: ro.typeId, name: ro.name }
            : null
        })
        .filter((r): r is { typeId: number; name: string } => r != null)
        .slice(0, 3)
    : []
  const structureTypeId = typeof o.structureTypeId === 'number' ? o.structureTypeId : null
  const solarSystemId =
    typeof o.solarSystemId === 'number' && Number.isInteger(o.solarSystemId) && o.solarSystemId > 0
      ? o.solarSystemId
      : null
  const facilityTaxPct =
    typeof o.facilityTaxPct === 'number' && Number.isFinite(o.facilityTaxPct)
      ? Math.max(0, Math.min(15, o.facilityTaxPct))
      : 0
  return {
    structureTypeId,
    structureName: typeof o.structureName === 'string' ? o.structureName : '',
    rigs,
    security,
    solarSystemId,
    solarSystemName: typeof o.solarSystemName === 'string' ? o.solarSystemName : '',
    facilityTaxPct,
  }
}

function parseTaxPct(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.max(0, Math.min(20, value))
}

export async function loadIndustryConfig(userId: string): Promise<IndustryConfigData> {
  const row = await prisma.industryConfig.findUnique({ where: { userId } })
  if (!row) return defaultIndustryConfig()

  const buyHubs = parseHubs(row.buyHubs)
  return {
    // An empty saved list still falls back to Jita so pricing never has zero hubs.
    buyHubs: buyHubs.length > 0 ? buyHubs : [JITA_HUB],
    sellHub: parseHub(row.sellHub) ?? (buyHubs[0] ?? JITA_HUB),
    defaultMe: Math.max(0, Math.min(10, row.defaultMe)),
    factory: parseFactory(row.factory),
    monitoredStations: parseHubs(row.monitoredStations).filter((h) => h.kind === 'structure'),
    salesTaxPct: parseTaxPct(row.salesTaxPct),
    brokerFeePct: parseTaxPct(row.brokerFeePct),
    industryCharacterId: parseCharacterId(row.industryCharacterId),
  }
}

const MAX_BUY_HUBS = 6
const MAX_MONITORED = 6

export async function saveIndustryConfig(
  userId: string,
  data: IndustryConfigData
): Promise<IndustryConfigData> {
  const buyHubs = parseHubs(data.buyHubs).slice(0, MAX_BUY_HUBS)
  const sellHub = parseHub(data.sellHub)
  const defaultMe = Math.max(0, Math.min(10, Math.floor(data.defaultMe ?? 0)))
  const factory = parseFactory(data.factory)
  const monitoredStations = parseHubs(data.monitoredStations)
    .filter((h) => h.kind === 'structure')
    .slice(0, MAX_MONITORED)
  const salesTaxPct = parseTaxPct(data.salesTaxPct ?? null)
  const brokerFeePct = parseTaxPct(data.brokerFeePct ?? null)
  const industryCharacterId = parseCharacterId(data.industryCharacterId ?? null)

  const sellHubValue = sellHub ? (sellHub as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
  const factoryValue = factory ? (factory as unknown as Prisma.InputJsonValue) : Prisma.JsonNull
  await prisma.industryConfig.upsert({
    where: { userId },
    create: {
      userId,
      buyHubs: buyHubs as unknown as Prisma.InputJsonValue,
      sellHub: sellHubValue,
      defaultMe,
      factory: factoryValue,
      monitoredStations: monitoredStations as unknown as Prisma.InputJsonValue,
      salesTaxPct,
      brokerFeePct,
      industryCharacterId,
    },
    update: {
      buyHubs: buyHubs as unknown as Prisma.InputJsonValue,
      sellHub: sellHubValue,
      defaultMe,
      factory: factoryValue,
      monitoredStations: monitoredStations as unknown as Prisma.InputJsonValue,
      salesTaxPct,
      brokerFeePct,
      industryCharacterId,
    },
  })

  return loadIndustryConfig(userId)
}
