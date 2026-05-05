/**
 * Reprocessing yields for EVE Online ores.
 * Yields are per batch of 100 units (standard batch size).
 * Variants (+5%, +10%, +15%) are handled by scaling these base values.
 */

export interface MineralYield {
  mineralId: number
  quantity: number
}

export const MINERALS = {
  TRITANIUM: 34,
  PYERITE: 35,
  MEXALLON: 36,
  ISOGEN: 37,
  NOCXIUM: 38,
  ZYDRINE: 39,
  MEGACYTE: 40,
  MORPHITE: 11399,
}

export const ICE_PRODUCTS = {
  HELIUM_ISOTOPES: 16274,
  NITROGEN_ISOTOPES: 17888,
  HYDROGEN_ISOTOPES: 17889,
  OXYGEN_ISOTOPES: 17887,
  HEAVY_WATER: 16272,
  LIQUID_OZONE: 16273,
  STRONTIUM_CLATHRATES: 16275,
}

export const MOON_MATERIALS = {
  HYDROCARBONS: 16633,
  SILICATES: 16636,
  EVAPORITE_DEPOSITS: 16635,
  ATMOSPHERIC_GASES: 16634,
  COBALT: 16640,
  TUNGSTEN: 16637,
  TITANIUM: 16638,
  VANADIUM: 16642,
  TECHNETIUM: 16649,
}

export const ORE_YIELDS: Record<string, MineralYield[]> = {
  // Asteroid Ores (Standard)
  'Veldspar': [{ mineralId: MINERALS.TRITANIUM, quantity: 415 }],
  'Scordite': [
    { mineralId: MINERALS.TRITANIUM, quantity: 346 },
    { mineralId: MINERALS.PYERITE, quantity: 173 }
  ],
  'Pyroxeres': [
    { mineralId: MINERALS.TRITANIUM, quantity: 351 },
    { mineralId: MINERALS.PYERITE, quantity: 25 },
    { mineralId: MINERALS.MEXALLON, quantity: 50 },
    { mineralId: MINERALS.NOCXIUM, quantity: 5 }
  ],
  'Plagioclase': [
    { mineralId: MINERALS.TRITANIUM, quantity: 107 },
    { mineralId: MINERALS.PYERITE, quantity: 213 },
    { mineralId: MINERALS.MEXALLON, quantity: 107 }
  ],
  'Omber': [
    { mineralId: MINERALS.TRITANIUM, quantity: 307 },
    { mineralId: MINERALS.PYERITE, quantity: 123 },
    { mineralId: MINERALS.ISOGEN, quantity: 307 }
  ],
  'Kernite': [
    { mineralId: MINERALS.TRITANIUM, quantity: 134 },
    { mineralId: MINERALS.MEXALLON, quantity: 267 },
    { mineralId: MINERALS.ISOGEN, quantity: 267 }
  ],
  'Jaspet': [
    { mineralId: MINERALS.PYERITE, quantity: 259 },
    { mineralId: MINERALS.MEXALLON, quantity: 259 },
    { mineralId: MINERALS.NOCXIUM, quantity: 259 }
  ],
  'Hemorphite': [
    { mineralId: MINERALS.PYERITE, quantity: 212 },
    { mineralId: MINERALS.ISOGEN, quantity: 424 },
    { mineralId: MINERALS.NOCXIUM, quantity: 424 },
    { mineralId: MINERALS.ZYDRINE, quantity: 28 }
  ],
  'Hedbergite': [
    { mineralId: MINERALS.ISOGEN, quantity: 450 },
    { mineralId: MINERALS.NOCXIUM, quantity: 450 },
    { mineralId: MINERALS.ZYDRINE, quantity: 120 }
  ],
  'Gneiss': [
    { mineralId: MINERALS.TRITANIUM, quantity: 2200 },
    { mineralId: MINERALS.PYERITE, quantity: 2200 },
    { mineralId: MINERALS.MEXALLON, quantity: 2200 }
  ],
  'Spodumain': [
    { mineralId: MINERALS.TRITANIUM, quantity: 48000 },
    { mineralId: MINERALS.PYERITE, quantity: 9600 },
    { mineralId: MINERALS.MEXALLON, quantity: 1600 },
    { mineralId: MINERALS.ISOGEN, quantity: 320 }
  ],
  'Dark Ochre': [
    { mineralId: MINERALS.TRITANIUM, quantity: 10000 },
    { mineralId: MINERALS.ISOGEN, quantity: 1600 },
    { mineralId: MINERALS.NOCXIUM, quantity: 320 }
  ],
  'Crokite': [
    { mineralId: MINERALS.TRITANIUM, quantity: 21000 },
    { mineralId: MINERALS.PYERITE, quantity: 350 },
    { mineralId: MINERALS.ZYDRINE, quantity: 520 }
  ],
  'Bistot': [
    { mineralId: MINERALS.PYERITE, quantity: 12000 },
    { mineralId: MINERALS.ZYDRINE, quantity: 450 },
    { mineralId: MINERALS.MEGACYTE, quantity: 100 }
  ],
  'Arkonor': [
    { mineralId: MINERALS.TRITANIUM, quantity: 22000 },
    { mineralId: MINERALS.MEXALLON, quantity: 2500 },
    { mineralId: MINERALS.MEGACYTE, quantity: 320 }
  ],
  'Mercoxit': [
    { mineralId: MINERALS.MORPHITE, quantity: 300 }
  ],

  // Ice Ores
  'Blue Ice': [
    { mineralId: ICE_PRODUCTS.OXYGEN_ISOTOPES, quantity: 350 },
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 40 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 25 }
  ],
  'Clear Icicle': [
    { mineralId: ICE_PRODUCTS.HELIUM_ISOTOPES, quantity: 350 },
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 40 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 25 }
  ],
  'White Glaze': [
    { mineralId: ICE_PRODUCTS.NITROGEN_ISOTOPES, quantity: 350 },
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 40 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 25 }
  ],
  'Glacial Mass': [
    { mineralId: ICE_PRODUCTS.HYDROGEN_ISOTOPES, quantity: 350 },
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 40 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 25 }
  ],
  'Dark Glitter': [
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 500 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 1000 },
    { mineralId: ICE_PRODUCTS.STRONTIUM_CLATHRATES, quantity: 50 }
  ],
  'Gelidus': [
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 250 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 500 },
    { mineralId: ICE_PRODUCTS.STRONTIUM_CLATHRATES, quantity: 75 }
  ],
  'Krystallos': [
    { mineralId: ICE_PRODUCTS.HEAVY_WATER, quantity: 100 },
    { mineralId: ICE_PRODUCTS.LIQUID_OZONE, quantity: 250 },
    { mineralId: ICE_PRODUCTS.STRONTIUM_CLATHRATES, quantity: 100 },
    { mineralId: MINERALS.TRITANIUM, quantity: 100 }
  ],

  // Moon Ores (Common)
  'Bitumens': [{ mineralId: MOON_MATERIALS.HYDROCARBONS, quantity: 100 }],
  'Coesite': [{ mineralId: MOON_MATERIALS.SILICATES, quantity: 100 }],
  'Sylvite': [{ mineralId: MOON_MATERIALS.EVAPORITE_DEPOSITS, quantity: 100 }],
  'Zeolites': [{ mineralId: MOON_MATERIALS.ATMOSPHERIC_GASES, quantity: 100 }],
  'Cobaltite': [{ mineralId: MOON_MATERIALS.COBALT, quantity: 100 }],
  'Scheelite': [{ mineralId: MOON_MATERIALS.TUNGSTEN, quantity: 100 }],
  'Titanite': [{ mineralId: MOON_MATERIALS.TITANIUM, quantity: 100 }],
  'Vanadinite': [{ mineralId: MOON_MATERIALS.VANADIUM, quantity: 100 }],
  'Chromite': [{ mineralId: MOON_MATERIALS.TECHNETIUM, quantity: 100 }],
}


/**
 * Gets the base name of an ore (removing variant prefixes like "Dense", "Stable", "Compressed").
 */
export function getBaseOreName(fullName: string): string {
  return fullName
    .replace('Compressed ', '')
    // 5% Variants
    .replace('Concentrated ', '')
    .replace('Condensed ', '')
    .replace('Solid ', '')
    .replace('Azure ', '')
    .replace('Golden ', '')
    .replace('Luminous ', '')
    .replace('Pure ', '')
    .replace('Vivid ', '')
    .replace('Vitric ', '')
    .replace('Iridescent ', '')
    .replace('Bright ', '')
    .replace('Onyx ', '')
    .replace('Sharp ', '')
    .replace('Triclinic ', '')
    .replace('Crimson ', '')
    .replace('Vitreous ', '')
    // 10% Variants
    .replace('Dense ', '')
    .replace('Massive ', '')
    .replace('Viscous ', '')
    .replace('Rich ', '')
    .replace('Silvery ', '')
    .replace('Fiery ', '')
    .replace('Pristine ', '')
    .replace('Radiant ', '')
    .replace('Glazed ', '')
    .replace('Prismatic ', '')
    .replace('Glowing ', '')
    .replace('Obsidian ', '')
    .replace('Crystalline ', '')
    .replace('Monoclinic ', '')
    .replace('Prime ', '')
    .replace('Magmatic ', '')
    // 15% Variants
    .replace('Stable ', '')
    .replace('Glossy ', '')
    .replace('Pliable ', '')
    .replace('Sparkling ', '')
    .replace('Resplendent ', '')
    .replace('Flawless ', '')
    .replace('Brilliant ', '')
    .replace('Brimful ', '')
    .replace('Copious ', '')
    .replace('Lavish ', '')
    .replace('Shimmering ', '')
    .replace('Bountiful ', '')
    // 100% Variants
    .replace('Glistening ', '')
    .replace('Glittering ', '')
    .replace('Shining ', '')
    .replace('Lucid ', '')
    // Grade suffixes
    .replace(' II-Grade', '')
    .replace(' III-Grade', '')
    .replace(' IV-Grade', '')
    .trim()
}

/**
 * Gets the bonus multiplier for an ore variant based on its prefix.
 */
export function getVariantBonus(fullName: string): number {
  const name = fullName.toLowerCase()
  
  // 100% Variants (Moon Ores)
  const jackpots = ['glistening', 'glittering', 'shining', 'lucid']
  if (jackpots.some(p => name.includes(p))) return 2.0

  // 15% Variants
  const high = ['stable', 'glossy', 'pliable', 'sparkling', 'resplendent', 'flawless', 'brilliant', 'brimful', 'copious', 'lavish', 'shimmering']
  if (high.some(p => name.includes(p))) return 1.15

  // 10% Variants
  const med = ['dense', 'massive', 'viscous', 'rich', 'silvery', 'fiery', 'pristine', 'radiant', 'glazed', 'prismatic', 'glowing', 'obsidian', 'crystalline', 'monoclinic', 'prime', 'magmatic']
  if (med.some(p => name.includes(p))) return 1.10

  // 5% Variants
  const low = ['concentrated', 'condensed', 'solid', 'azure', 'golden', 'luminous', 'pure', 'vivid', 'vitric', 'iridescent', 'bright', 'onyx', 'sharp', 'triclinic', 'crimson', 'vitreous']
  if (low.some(p => name.includes(p))) return 1.05

  return 1.0
}

export function getReprocessingYield(typeName: string): MineralYield[] {
  const baseName = getBaseOreName(typeName)
  const bonus = getVariantBonus(typeName)
  
  const baseYield = ORE_YIELDS[baseName] || []
  return baseYield.map(y => ({
    mineralId: y.mineralId,
    quantity: Math.floor(y.quantity * bonus)
  }))
}
