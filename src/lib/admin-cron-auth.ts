import crypto from 'crypto'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

/**
 * Constant-time string compare. Hashing both sides to a fixed 32 bytes keeps the
 * comparison timing-independent of length and content (avoids a `===` timing
 * side-channel on the secret).
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  const ah = crypto.createHash('sha256').update(a).digest()
  const bh = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(ah, bh)
}

/**
 * True if the request carries the CRON_SECRET, via header (preferred) or the legacy
 * `?token=` query string. A query-string secret gets written verbatim into access
 * logs and reverse-proxy logs — the header form should be used for any new caller.
 * The query-string form is kept only for backward compatibility with callers already
 * configured to use it (e.g. an external Coolify cron trigger not managed in this
 * repo); once every caller is migrated to the header, drop this fallback.
 */
export function cronSecretMatches(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const authHeader = request.headers.get('authorization')
  if (authHeader) {
    const [scheme, value] = authHeader.split(' ')
    if (scheme === 'Bearer' && value && timingSafeStringEqual(value, secret)) return true
  }

  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  return token !== null && timingSafeStringEqual(token, secret)
}

/** Allows master session or a CRON_SECRET (header or legacy `?token=`). */
export async function requireMasterOrCronToken(request: Request): Promise<void> {
  if (cronSecretMatches(request)) {
    return
  }

  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }
  if (user.role !== 'master') {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Admin access required', 403)
  }
}
