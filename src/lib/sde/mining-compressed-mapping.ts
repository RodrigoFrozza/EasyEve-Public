/**
 * Mining type compression mapping based on EVE Online data.
 * Each raw ore has a corresponding compressed version.
 * Refined is calculated from reprocessing yields, not a direct type ID.
 */

export const COMPRESSED_MAPPING: Record<number, number> = {
  // Veldspar
  1230: 28432, // Veldspar → Compressed Veldspar
  17470: 28430, // Concentrated Veldspar → Compressed Concentrated Veldspar
  17471: 28431, // Dense Veldspar → Compressed Dense Veldspar

  // Scordite
  1228: 28428, // Scordite → Compressed Scordite
  17463: 28426, // Condensed Scordite → Compressed Condensed Scordite
  17464: 28427, // Massive Scordite → Compressed Massive Scordite

  // Pyroxeres
  1224: 28424, // Pyroxeres → Compressed Pyroxeres
  17459: 28422, // Solid Pyroxeres → Compressed Solid Pyroxeres
  17460: 28423, // Viscous Pyroxeres → Compressed Viscous Pyroxeres

  // Plagioclase
  18: 28420, // Plagioclase → Compressed Plagioclase
  17453: 28417, // Azure Plagioclase → Compressed Azure Plagioclase
  17454: 28418, // Rich Plagioclase → Compressed Rich Plagioclase
  17455: 28419, // Sparkling Plagioclase → Compressed Sparkling Plagioclase

  // Omber
  1227: 28416, // Omber → Compressed Omber
  17865: 62515, // Silvery Omber → Compressed Silvery Omber
  17866: 62516, // Golden Omber → Compressed Golden Omber
  17867: 62517, // Platinoid Omber → Compressed Platinoid Omber

  // Kernite
  20: 28412, // Kernite → Compressed Kernite
  17456: 28409, // Luminous Kernite → Compressed Luminous Kernite
  17457: 28410, // Fiery Kernite → Compressed Fiery Kernite
  17458: 28411, // Resplendant Kernite → Compressed Resplendant Kernite

  // Jaspet
  1226: 28408, // Jaspet → Compressed Jaspet
  17448: 28405, // Pure Jaspet → Compressed Pure Jaspet
  17449: 28406, // Pristine Jaspet → Compressed Pristine Jaspet
  17450: 28407, // Efflorescent Jaspet → Compressed Efflorescent Jaspet

  // Hemorphite
  1231: 28404, // Hemorphite → Compressed Hemorphite
  17444: 28401, // Vivid Hemorphite → Compressed Vivid Hemorphite
  17445: 28402, // Radiant Hemorphite → Compressed Radiant Hemorphite
  17446: 28403, // Glistening Hemorphite → Compressed Glistening Hemorphite

  // Hedbergite
  21: 28400, // Hedbergite → Compressed Hedbergite
  17440: 28397, // Vitric Hedbergite → Compressed Vitric Hedbergite
  17441: 28398, // Glazed Hedbergite → Compressed Glazed Hedbergite
  17442: 28399, // Opulent Hedbergite → Compressed Opulent Hedbergite

  // Gneiss
  1229: 28396, // Gneiss → Compressed Gneiss
  17436: 28393, // Iridescent Gneiss → Compressed Iridescent Gneiss
  17437: 28394, // Prismatic Gneiss → Compressed Prismatic Gneiss
  17438: 28395, // Crystalline Gneiss → Compressed Crystalline Gneiss

  // Dark Ochre
  1232: 28392, // Dark Ochre → Compressed Dark Ochre
  17432: 28389, // Onyx Dark Ochre → Compressed Onyx Dark Ochre
  17433: 28390, // Obsidian Dark Ochre → Compressed Obsidian Dark Ochre
  17434: 28391, // Obscure Dark Ochre → Compressed Obscure Dark Ochre

  // Crokite
  1225: 28388, // Crokite → Compressed Crokite
  17428: 28385, // Sharp Crokite → Compressed Sharp Crokite
  17429: 28386, // Triclinic Crokite → Compressed Triclinic Crokite
  17430: 28387, // Monoclinic Crokite → Compressed Monoclinic Crokite

  // Bistot
  1223: 28384, // Bistot → Compressed Bistot
  17425: 28381, // Triclinic Bistot → Compressed Triclinic Bistot
  17426: 28382, // Monoclinic Bistot → Compressed Monoclinic Bistot
  17427: 28383, // Crystalline Bistot → Compressed Crystalline Bistot

  // Arkonor
  22: 28380, // Arkonor → Compressed Arkonor
  17422: 28377, // Crimson Arkonor → Compressed Crimson Arkonor
  17423: 28378, // Prime Arkonor → Compressed Prime Arkonor
  17424: 28379, // Crystalline Arkonor → Compressed Crystalline Arkonor

  // Spodumain
  19: 28376, // Spodumain → Compressed Spodumain
  17418: 28373, // Bright Spodumain → Compressed Bright Spodumain
  17419: 28374, // Gleaming Spodumain → Compressed Gleaming Spodumain
  17420: 28375, // Dazzling Spodumain → Compressed Dazzling Spodumain

  // Mercoxit
  11396: 28372, // Mercoxit → Compressed Mercoxit
  17869: 28493, // Magma Mercoxit → Compressed Magma Mercoxit
  17870: 28494, // Vitreous Mercoxit → Compressed Vitreous Mercoxit

  // Ice types
  16267: 28526, // Clear Icicle → Compressed Clear Icicle
  17978: 28528, // Enriched Clear Icicle → Compressed Enriched Clear Icicle
  17979: 28530, // Crystalline Clear Icicle → Compressed Crystalline Clear Icicle

  16268: 28538, // White Glaze → Compressed White Glaze
  17980: 28540, // Pristine White Glaze → Compressed Pristine White Glaze
  17981: 28542, // Smooth White Glaze → Compressed Smooth White Glaze

  16264: 28496, // Blue Ice → Compressed Blue Ice
  17898: 28498, // Thick Blue Ice → Compressed Thick Blue Ice
  17899: 28500, // Crystalline Blue Ice → Compressed Crystalline Blue Ice

  16266: 28532, // Glare Crust → Compressed Glare Crust
  17968: 28534, // Thick Glare Crust → Compressed Thick Glare Crust
  17969: 28536, // Crystalline Glare Crust → Compressed Crystalline Glare Crust

  16265: 28520, // Dark Glitter → Compressed Dark Glitter
  17970: 28522, // Glistening Dark Glitter → Compressed Glistening Dark Glitter
  17971: 28524, // Bistre Dark Glitter → Compressed Bistre Dark Glitter

  17887: 28544, // Gelidus → Compressed Gelidus
  17972: 28546, // Lucent Gelidus → Compressed Lucent Gelidus
  17973: 28548, // Opalescent Gelidus → Compressed Opalescent Gelidus

  17885: 28550, // Krystallos → Compressed Krystallos
  17974: 28552, // Lucent Krystallos → Compressed Lucent Krystallos
  17975: 28554, // Opalescent Krystallos → Compressed Opalescent Krystallos

  17886: 28556, // Glacial Mass → Compressed Glacial Mass
  17976: 28558, // Smooth Glacial Mass → Compressed Smooth Glacial Mass
  17977: 28560, // Pristine Glacial Mass → Compressed Pristine Glacial Mass
}

/**
 * Get compressed type ID from raw type ID
 */
export function getCompressedId(rawTypeId: number): number | undefined {
  return COMPRESSED_MAPPING[rawTypeId]
}

/**
 * Check if a type ID is a compressed variant
 */
export function isCompressedType(typeId: number): boolean {
  return Object.values(COMPRESSED_MAPPING).includes(typeId)
}

/**
 * Get raw type ID from compressed type ID
 */
export function getRawFromCompressed(compressedTypeId: number): number | undefined {
  return Object.entries(COMPRESSED_MAPPING).find(([, compressed]) => compressed === compressedTypeId)?.[0] as number | undefined
}
