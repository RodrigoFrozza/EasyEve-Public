type MiningCategory = 'Ore' | 'Ice' | 'Gas' | 'Moon'

/**
 * Rough spawn-tier filter for asteroid ores by security band.
 * Does not model every belt variant; narrows "most valuable" lists for setup UX.
 */
const NULLSEC_RARE_SUBSTRINGS = [
  'Mercoxit',
  'Arkonor',
  'Bistot',
  'Crokite',
  'Spodumain',
  'Bezdnacine',
  'Rakovene',
  'Talassonite',
  'Monazite',
  'Bitumens',
  'Coesite',
  'Sylvite',
  'Zeolites',
  'Jacolith',
  'Opulent',
  'Ubiquitous',
]

function nameLooksNullsecRare(name: string): boolean {
  const n = name.toLowerCase()
  return NULLSEC_RARE_SUBSTRINGS.some((s) => n.includes(s.toLowerCase()))
}

export function filterMiningTypesBySpace<T extends { name: string }>(
  types: T[],
  miningCategory: MiningCategory,
  space: string | undefined
): T[] {
  if (miningCategory !== 'Ore' || !space) return types
  if (space === 'Nullsec' || space === 'Wormhole' || space === 'Pochven') return types
  if (space === 'Highsec') {
    return types.filter((t) => !nameLooksNullsecRare(t.name))
  }
  // Lowsec: allow more than highsec but still hide obvious null-only rares
  if (space === 'Lowsec') {
    const hardNullOnly = ['Mercoxit', 'Arkonor', 'Bistot', 'Crokite', 'Spodumain']
    return types.filter((t) => {
      const n = t.name.toLowerCase()
      return !hardNullOnly.some((s) => n.includes(s.toLowerCase()))
    })
  }
  return types
}
