import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'

/**
 * A refresh failing with invalid_grant/token_invalid means the player revoked
 * EasyEve's access (or the token died): only a new SSO login brings it back.
 * The character is flagged by setting tokenExpiresAt to epoch+1ms — the
 * long-standing convention the UI and sync code read.
 */
export const REVOKED_TOKEN_SENTINEL_MS = 1

export function isTokenRevoked(tokenExpiresAt: Date | null | undefined): boolean {
  return !!tokenExpiresAt && tokenExpiresAt.getTime() <= REVOKED_TOKEN_SENTINEL_MS
}

export function isRevocationError(error: string | null | undefined): boolean {
  return error === 'invalid_grant' || error === 'token_invalid'
}

/**
 * Flags the character's token as revoked and, the first time only, tells the
 * owner through the bell. Before this, the flag was set silently: ~15
 * characters sat revoked for months and their owners just saw data stop.
 * Notification failures are logged, never thrown — the flag is what matters.
 */
export async function markCharacterTokenRevoked(characterId: number): Promise<void> {
  const sentinel = new Date(REVOKED_TOKEN_SENTINEL_MS)
  const { count } = await prisma.character.updateMany({
    where: {
      id: characterId,
      OR: [{ tokenExpiresAt: null }, { tokenExpiresAt: { not: sentinel } }],
    },
    data: { tokenExpiresAt: sentinel },
  })
  if (count === 0) return // already flagged (or gone): the owner was told before

  try {
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      select: { name: true, userId: true, user: { select: { accountCode: true } } },
    })
    if (!character) return

    const accountCode = character.user.accountCode
    await prisma.notification.create({
      data: {
        userId: character.userId,
        type: 'system',
        title: `Reconecte ${character.name}`,
        content:
          `O acesso do EasyEve à ESI de ${character.name} foi revogado ou expirou, ` +
          'e os dados desse personagem pararam de sincronizar. Faça login com ele de novo para voltar.',
        link: accountCode ? `/link-character?accountCode=${encodeURIComponent(accountCode)}` : '/dashboard/characters',
      },
    })
  } catch (error) {
    logger.error('TokenRevocation', `Failed to notify owner of revoked character ${characterId}`, error)
  }
}
