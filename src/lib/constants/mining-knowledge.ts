/**
 * EVE Online mining domain knowledge for Miner's Rest education & tool defaults.
 * Sources: EVE University Wiki, official dev blogs, INN mining guides.
 */

export const MINERAL_NAMES = [
  'Tritanium',
  'Pyerite',
  'Mexallon',
  'Isogen',
  'Nocxium',
  'Zydrine',
  'Megacyte',
  'Morphite',
] as const

export const ORE_VARIANT_BONUSES = [
  { suffix: ' II-Grade', bonusPct: 5 },
  { suffix: ' III-Grade', bonusPct: 10 },
  { suffix: ' IV-Grade', bonusPct: 15 },
] as const

export const ORES_BY_SPACE: Record<string, string[]> = {
  Highsec: ['Veldspar', 'Scordite', 'Pyroxeres', 'Plagioclase', 'Omber', 'Kernite'],
  Lowsec: [
    'Pyroxeres',
    'Kernite',
    'Omber',
    'Jaspet',
    'Hemorphite',
    'Hedbergite',
  ],
  Nullsec: [
    'Veldspar',
    'Kernite',
    'Pyroxeres',
    'Spodumain',
    'Dark Ochre',
    'Gneiss',
    'Crokite',
    'Bistot',
    'Arkonor',
    'Mercoxit',
  ],
  Wormhole: ['Arkonor', 'Bistot', 'Gneiss', 'Kernite', 'Omber', 'Pyroxeres'],
  Pochven: ['Bezdnacine', 'Rakovene', 'Talassonite'],
}

export const MOON_ORE_RARITY = [
  {
    tier: 'Ubiquitous (R4)',
    ores: ['Zeolites', 'Sylvite', 'Bitumens', 'Coesite'],
    spaces: ['Highsec', 'Lowsec', 'Nullsec', 'Wormhole'],
  },
  {
    tier: 'Common (R8)',
    ores: ['Cobaltite', 'Euxenite', 'Titanite', 'Scheelite'],
    spaces: ['Lowsec', 'Nullsec'],
  },
  {
    tier: 'Uncommon (R16)',
    ores: ['Otavite', 'Sperrylite', 'Vanadinite', 'Chromite'],
    spaces: ['Lowsec', 'Nullsec'],
  },
  {
    tier: 'Rare (R32)',
    ores: ['Carnotite', 'Zircon', 'Pollucite', 'Cinnabar'],
    spaces: ['Lowsec', 'Nullsec'],
  },
  {
    tier: 'Exceptional (R64)',
    ores: ['Xenotime', 'Monazite', 'Loparite', 'Ytterbite'],
    spaces: ['Lowsec', 'Nullsec'],
  },
] as const

export const REPROCESSING_NOTES = {
  batchSizeOre: 100,
  batchSizeIce: 1,
  compressionRatio: 100,
  maxNpcStationYieldPct: 70,
  maxUpwellNullYieldPct: 87.52,
  skillBonuses: {
    reprocessingPerLevel: 3,
    reprocessingEfficiencyPerLevel: 2,
    oreProcessingPerLevel: 2,
    maxImplantBonusPct: 4,
  },
} as const

export const COMPRESSION_NOTES = {
  oreUnitsPerCompressed: 100,
  iceVolumeReduction: 10,
  summary:
    'Compression does not change mineral yield per batch; it reduces cargo volume for hauling and trading.',
} as const

export const GAS_TYPES = {
  knownSpace: ['Mykoserocin', 'Cytoserocin'],
  wormhole: ['C320', 'C540', 'C28', 'C32', 'C36', 'C50', 'C60', 'C70', 'C72', 'C84'],
} as const

export const ICE_PRODUCTS = [
  'Heavy Water',
  'Liquid Ozone',
  'Strontium Clathrates',
  'Helium Isotopes',
  'Hydrogen Isotopes',
  'Nitrogen Isotopes',
  'Oxygen Isotopes',
] as const

export const MARKET_NOTES = {
  hubRegion: 'The Forge (Jita)',
  hubRegionId: 10000002,
  summary:
    'Ore profitability shifts with mineral demand. Compare raw, compressed, and refined values before committing to a mining route.',
} as const

export function getOresForSpace(space: string | undefined): string[] {
  if (!space) return []
  return ORES_BY_SPACE[space] ?? []
}

export function normalizeSpaceKey(space: string): string | null {
  const normalized = space.trim()
  return (
    ['Highsec', 'Lowsec', 'Nullsec', 'Wormhole', 'Pochven'].find(
      (s) => s.toLowerCase() === normalized.toLowerCase()
    ) ?? null
  )
}
