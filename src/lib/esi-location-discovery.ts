import { getErrorCode } from './app-error'
import { ErrorCodes } from './error-codes'
import { parseScopesFromJwt } from './utils'

/**
 * Shared discriminated result for the structure/container discovery routes
 * (GET /api/characters/[id]/structures and /assets). Lets the UI show a
 * specific message instead of a single generic "nothing found" for every
 * failure mode.
 */
export type LocationDiscoveryFailureReason =
  | 'network'
  | 'missing_scopes'
  | 'rate_limited'
  | 'no_valid_locations'
  | 'empty'

export type LocationDiscoveryResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: LocationDiscoveryFailureReason }

const REQUIRED_ASSET_SCOPE = 'esi-assets.read_assets.v1'

export function hasAssetReadScope(accessToken: string | null | undefined): boolean {
  if (!accessToken) return false
  try {
    const scopes = parseScopesFromJwt(accessToken)
    return scopes.includes(REQUIRED_ASSET_SCOPE)
  } catch {
    return false
  }
}

/** Classifies an ESI fetch failure once missing_scopes has already been ruled out. */
export function classifyEsiFetchFailure(error: unknown): 'network' | 'rate_limited' {
  const code = getErrorCode(error)
  if (code === ErrorCodes.ESI_ERROR_LIMIT_EXCEEDED || code === ErrorCodes.ESI_RATE_LIMITED) {
    return 'rate_limited'
  }
  return 'network'
}
