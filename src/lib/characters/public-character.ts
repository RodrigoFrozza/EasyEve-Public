import { parseScopesFromJwt } from '@/lib/utils'

interface CharacterWithSensitiveFields {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
  shipTypeId: number | null
  lastFetchedAt: Date | null
  isMain: boolean
  esiApp: string
  corporationId: number | null
  tokenExpiresAt: Date | null
  tags: string[] | null
  accessToken?: string | null
}

export interface PublicCharacterDto {
  id: number
  name: string
  totalSp: number
  walletBalance: number
  location: string | null
  ship: string | null
  shipTypeId: number | null
  lastFetchedAt: Date | null
  isMain: boolean
  esiApp: string
  corporationId: number | null
  tokenExpiresAt: Date | null
  tags: string[]
  scopes: string[]
}

export function toPublicCharacter(character: CharacterWithSensitiveFields): PublicCharacterDto {
  return {
    id: character.id,
    name: character.name,
    totalSp: character.totalSp,
    walletBalance: character.walletBalance,
    location: character.location,
    ship: character.ship,
    shipTypeId: character.shipTypeId,
    lastFetchedAt: character.lastFetchedAt,
    isMain: character.isMain,
    esiApp: character.esiApp || 'main',
    corporationId: character.corporationId,
    tokenExpiresAt: character.tokenExpiresAt,
    tags: character.tags ?? [],
    scopes: character.accessToken ? parseScopesFromJwt(character.accessToken) : [],
  }
}
