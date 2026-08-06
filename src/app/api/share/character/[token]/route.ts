import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { getSharedProfileByToken } from '@/lib/characters/share-profile'

export const dynamic = 'force-dynamic'

/**
 * GET /api/share/character/[token] - Public, unauthenticated lookup of a shared
 * Character Profile by its secret token. Deliberately NOT wrapped in withAuth:
 * this is the whole point of the token-based share link (no login required for
 * visitors). middleware.ts only gates /dashboard and /link-character behind
 * session auth — /api/* routes besides /api/auth/* just get the same-origin
 * request check, so this stays reachable without a session cookie.
 *
 * Returns 404 (not an empty/partial profile) whenever the token doesn't resolve
 * to a character with sharing currently enabled — an unknown, disabled, or
 * rotated-away token must behave identically to the visitor.
 */
export const GET = withErrorHandling(async (_request: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params

  const profile = await getSharedProfileByToken(token)

  if (!profile) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Shared profile not found', 404)
  }

  return profile
})
