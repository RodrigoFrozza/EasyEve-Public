/**
 * Character payload used on the dashboard characters page and related client components.
 * Dates may be ISO strings after JSON boundaries; client code normalizes with `new Date`.
 */
export interface CharacterListItem {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
  lastFetchedAt: Date | string | null
  isMain: boolean
  scopes: string[]
  esiApp: string
  corporationId?: number | null
  tokenExpiresAt?: Date | string | null
  tags: string[]
  /** Present when loaded from GET /api/characters/[id] (client hook). */
  accessToken?: string | null
}
