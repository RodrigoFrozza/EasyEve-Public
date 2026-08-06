import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import {
  runMiningActivitySync,
  type MiningSyncMode,
} from '@/lib/activities/mining-activity-sync'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')
  const modeParam = searchParams.get('mode')

  if (!activityId) {
    throw new AppError(ErrorCodes.VALIDATION_FAILED, 'Activity ID is required', 400)
  }

  let mode: MiningSyncMode = modeParam === 'initial' || modeParam === 'regular' ? modeParam : null
  let forceEsiBaseline = false

  if (modeParam === 'rebaseline') {
    mode = 'initial'
    forceEsiBaseline = true
  }

  // This route is only ever hit by the user clicking "Sync API" on the card, so a
  // paused session must still refresh (allowPaused) — otherwise the button silently
  // no-ops while the UI reports success. Data refreshes; the paused timer stays frozen.
  return runMiningActivitySync({
    userId: user.id,
    activityId,
    mode,
    forceEsiBaseline,
    allowPaused: true,
  })
})
