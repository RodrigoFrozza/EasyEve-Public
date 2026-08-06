import { prisma } from '@/lib/prisma'
import type { PiPricingMode } from '@/lib/pi/pi-pricing'
import type { PiPlanetConfigView } from '@/lib/pi/types'

export type PiSellSource = 'home_region' | 'jita_sell' | 'jita_buy' | 'jita_split' | 'structure'

export interface PiUserPreferences {
  exportTaxRate: number
  /** POCO import tax on bought inputs. Null = use exportTaxRate (same as before). */
  importTaxRate: number | null
  pricingMode: PiPricingMode
  /** Region the player trades in for real order-book pricing. Null = Jita. */
  homeRegionId: number | null
  /** Private structure market to buy inputs from (falls back to region then Jita). */
  buyStructureId: string | null
  buyStructureName: string | null
  /** Second buy structure shown for comparison in the Shopping List only. */
  buyStructureId2: string | null
  buyStructureName2: string | null
  /** Where the produced output is valued for sale. */
  sellSource: PiSellSource
  sellStructureId: string | null
  sellStructureName: string | null
  /** Restock cadence (hours) driving PI alert thresholds. Null = 24h default. */
  visitCadenceHrs: number | null
}

export async function loadPiUserConfig(userId: string): Promise<{
  configs: PiPlanetConfigView[]
  preferences: PiUserPreferences
}> {
  const [configRows, profile] = await Promise.all([
    prisma.piPlanetConfig.findMany({
      where: { userId },
    }),
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        piExportTaxRate: true,
        piPocoImportRate: true,
        piPricingMode: true,
        piHomeRegionId: true,
        piBuyStructureId: true,
        piBuyStructureName: true,
        piBuyStructureId2: true,
        piBuyStructureName2: true,
        piSellSource: true,
        piSellStructureId: true,
        piSellStructureName: true,
        piVisitCadenceHrs: true,
      },
    }),
  ])

  const configs: PiPlanetConfigView[] = configRows.map((c) => ({
    planetId: c.planetId,
    surplusForSale: c.surplusForSale,
  }))

  const preferences: PiUserPreferences = {
    exportTaxRate: profile?.piExportTaxRate ?? 0.1,
    importTaxRate: profile?.piPocoImportRate ?? null,
    pricingMode: (profile?.piPricingMode as PiPricingMode | null) ?? 'import_buy_export_sell',
    homeRegionId: profile?.piHomeRegionId ?? null,
    buyStructureId: profile?.piBuyStructureId ?? null,
    buyStructureName: profile?.piBuyStructureName ?? null,
    buyStructureId2: profile?.piBuyStructureId2 ?? null,
    buyStructureName2: profile?.piBuyStructureName2 ?? null,
    sellSource: (profile?.piSellSource as PiSellSource | null) ?? 'home_region',
    sellStructureId: profile?.piSellStructureId ?? null,
    sellStructureName: profile?.piSellStructureName ?? null,
    visitCadenceHrs: profile?.piVisitCadenceHrs ?? null,
  }

  return { configs, preferences }
}
