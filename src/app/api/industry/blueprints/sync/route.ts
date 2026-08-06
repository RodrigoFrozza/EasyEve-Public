export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { syncUserBlueprints } from '@/lib/industry/blueprint-sync'

/**
 * Forces a fresh ESI blueprint sync for every character of the current user
 * (maxAgeMs: 0 bypasses the 60-min freshness window used by the on-demand sync
 * in blueprint-cost). Per-character failures are surfaced in `failed`, never
 * hidden — a character losing its token must not look like it has no blueprints.
 */
export const POST = withErrorHandling(async () => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const result = await syncUserBlueprints(user.id, { maxAgeMs: 0 })

  return NextResponse.json({
    characters: result.characters,
    synced: result.synced,
    failed: result.failed,
    lastSyncedAt: result.lastSyncedAt,
  })
})
