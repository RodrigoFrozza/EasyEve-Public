import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { writeCharacterSnapshot } from '@/lib/characters/snapshot'
import { toOwnerProfileDto } from '@/lib/characters/share-profile'
import { generateShareToken } from '@/lib/characters/share-token'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

/**
 * GET /api/characters/[id]/profile - Owner view of the Character Profile.
 * Refreshes the persisted CharacterSnapshot from ESI (degrading per-item on
 * missing scopes rather than failing outright) and returns the owner DTO,
 * which additionally carries isOmega/shareToken/missingScopes.
 */
export const GET = withErrorHandling(withAuth(async (_request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)

  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id,
    },
  })

  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }

  const { missingScopes } = await writeCharacterSnapshot(character)

  const refreshed = await prisma.character.findUnique({
    where: { id: characterId },
    include: { snapshot: true },
  })

  if (!refreshed) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }

  return toOwnerProfileDto(refreshed, missingScopes)
}))

const PatchBodySchema = z.object({
  isOmega: z.boolean().optional(),
  shareAction: z.enum(['enable', 'rotate', 'disable']).optional(),
})

/**
 * PATCH /api/characters/[id]/profile - Toggle Omega status and/or the shareable
 * link. `shareAction: 'enable'` mints a token only if one doesn't already exist;
 * 'rotate' always mints a fresh one (invalidating any previously shared link);
 * 'disable' clears it (existing link 404s immediately).
 */
export const PATCH = withErrorHandling(withAuth(async (request, user, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params
  const characterId = parseInt(id, 10)

  const character = await prisma.character.findFirst({
    where: {
      id: characterId,
      userId: user.id,
    },
  })

  if (!character) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Character not found', 404)
  }

  const body = await validateBody(request, PatchBodySchema)

  const data: { isOmega?: boolean; shareToken?: string | null } = {}

  if (body.isOmega !== undefined) {
    data.isOmega = body.isOmega
  }

  if (body.shareAction === 'enable') {
    data.shareToken = character.shareToken ?? generateShareToken()
  } else if (body.shareAction === 'rotate') {
    data.shareToken = generateShareToken()
  } else if (body.shareAction === 'disable') {
    data.shareToken = null
  }

  const updated = await prisma.character.update({
    where: { id: characterId },
    data,
  })

  return { isOmega: updated.isOmega, shareToken: updated.shareToken }
}))
