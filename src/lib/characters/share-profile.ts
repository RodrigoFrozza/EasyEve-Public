import { prisma } from '@/lib/prisma'

/**
 * Narrow input shape accepted by the DTO builders below. Deliberately does NOT
 * include accessToken/refreshToken/walletBalance/location/ship/userId/ownerHash —
 * even if a caller passes a full Prisma `Character` (which does carry those
 * fields), the mappers below only ever read the fields listed here, so sensitive
 * data can never leak into the output DTOs.
 */
interface CharacterProfileSource {
  id: number
  name: string
  corporationId: number | null
  birthday: Date | null
  raceId: number | null
  bloodlineId: number | null
  gender: string | null
  securityStatus: number | null
  isOmega: boolean | null
  shareToken?: string | null
  snapshot?: CharacterSnapshotSource | null
}

interface CharacterSnapshotSource {
  totalSp: number
  unallocatedSp: number | null
  skills: unknown
  skillqueue: unknown
  attributes: unknown
  implants: unknown
  capturedAt: Date
}

/**
 * Safe DTO for the public shareable profile. NEVER add accessToken, refreshToken,
 * walletBalance, location, ship, userId, shareToken, or ownerHash to this shape —
 * this is exactly what an anonymous visitor with the link receives.
 */
export interface SharedProfileDto {
  name: string
  characterId: number
  corporationId: number | null
  birthday: Date | null
  raceId: number | null
  bloodlineId: number | null
  gender: string | null
  securityStatus: number | null
  isOmega: boolean | null
  totalSp: number | null
  unallocatedSp: number | null
  skills: unknown
  skillqueue: unknown
  attributes: unknown
  implants: unknown
  capturedAt: Date | null
}

/** Owner-only view: same safe fields, plus the share link's own token and any
 * scopes missing for the live snapshot refresh (never raw ESI tokens). */
export interface OwnerProfileDto extends SharedProfileDto {
  shareToken: string | null
  missingScopes: string[]
}

export function toSharedProfileDto(character: CharacterProfileSource): SharedProfileDto {
  const snapshot = character.snapshot ?? null

  return {
    name: character.name,
    characterId: character.id,
    corporationId: character.corporationId,
    birthday: character.birthday,
    raceId: character.raceId,
    bloodlineId: character.bloodlineId,
    gender: character.gender,
    securityStatus: character.securityStatus,
    isOmega: character.isOmega ?? null,
    totalSp: snapshot?.totalSp ?? null,
    unallocatedSp: snapshot?.unallocatedSp ?? null,
    skills: snapshot?.skills ?? null,
    skillqueue: snapshot?.skillqueue ?? null,
    attributes: snapshot?.attributes ?? null,
    implants: snapshot?.implants ?? null,
    capturedAt: snapshot?.capturedAt ?? null,
  }
}

export function toOwnerProfileDto(
  character: CharacterProfileSource,
  missingScopes: string[] = []
): OwnerProfileDto {
  return {
    ...toSharedProfileDto(character),
    shareToken: character.shareToken ?? null,
    missingScopes,
  }
}

/**
 * Resolves a public shareable profile by its secret token. Returns null when the
 * token doesn't match any character OR the owner has since disabled/rotated
 * sharing (shareToken cleared to null) — callers should turn null into a 404,
 * never a partial/empty profile.
 */
export async function getSharedProfileByToken(token: string): Promise<SharedProfileDto | null> {
  if (!token) return null

  // findFirst (not findUnique): shareToken is a plain indexed column, not a
  // unique key — see the schema note. The token's 128-bit entropy makes a
  // collision effectively impossible, so the first match is the only match.
  const character = await prisma.character.findFirst({
    where: { shareToken: token },
    include: { snapshot: true },
  })

  if (!character || !character.shareToken) return null

  return toSharedProfileDto(character)
}
