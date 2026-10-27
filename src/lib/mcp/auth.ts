import { timingSafeStringEqual } from '@/lib/admin-cron-auth'

/** MCP_TOKEN shorter than this is treated as unset — guards against a placeholder value. */
export const MIN_MCP_TOKEN_LENGTH = 32

export function mcpTokenConfigured(): boolean {
  return (process.env.MCP_TOKEN ?? '').length >= MIN_MCP_TOKEN_LENGTH
}

/**
 * True if the Authorization header is `Bearer <MCP_TOKEN>`.
 *
 * Deliberately separate from CRON_SECRET (different blast radius, rotated
 * independently) and header-only — no `?token=` fallback, since a query-string
 * secret ends up in proxy access logs.
 */
export function mcpTokenMatches(authorization: string | null): boolean {
  const secret = process.env.MCP_TOKEN
  if (!secret || !mcpTokenConfigured() || !authorization) return false

  const [scheme, value] = authorization.split(' ')
  return scheme === 'Bearer' && !!value && timingSafeStringEqual(value, secret)
}
