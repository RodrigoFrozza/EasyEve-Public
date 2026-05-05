/**
 * Character payload used on the dashboard characters page and related client components.
 * Uniform with PublicCharacterDto from @/lib/characters/public-character.
 */
export interface CharacterListItem {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
  shipTypeId: number | null
  lastFetchedAt: Date | null
  isMain: boolean
  scopes: string[]
  esiApp: string
  corporationId: number | null
  tokenExpiresAt: Date | null
  tags: string[]
}
