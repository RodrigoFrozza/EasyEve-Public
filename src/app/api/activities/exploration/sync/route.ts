import { prisma } from '@/lib/prisma'
import { getCharacterLocation, getCharacterShip } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import { withErrorHandling } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const POST = withErrorHandling(async (request: Request) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const { searchParams } = new URL(request.url)
  const activityId = searchParams.get('id')

  if (!activityId) {
    throw new AppError(ErrorCodes.INVALID_INPUT, 'Activity ID is required', 400)
  }

  const activity = await prisma.activity.findUnique({
    where: { id: activityId }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Activity not found', 404)
  }

  if (activity.userId !== user.id) {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'You do not own this activity', 403)
  }

  const participants = activity.participants as any[]
  const updatedParticipants = []

  for (const participant of participants) {
    const charId = participant.characterId
    const { accessToken, error: tokenError } = await getValidAccessToken(charId)

    if (!accessToken) {
      // If token is invalid, we keep current data but mark it or just continue
      updatedParticipants.push(participant)
      continue
    }

    // Fetch live data
    const [locationData, shipData] = await Promise.all([
      getCharacterLocation(charId, accessToken),
      getCharacterShip(charId, accessToken)
    ])

    // Update Character table for persistent view elsewhere
    await prisma.character.update({
      where: { id: charId },
      data: {
        location: locationData.location || participant.location,
        ship: shipData.ship || participant.shipName,
        shipTypeId: shipData.shipTypeId || participant.shipTypeId
      }
    })

    // Prepare updated participant object for the Activity record
    updatedParticipants.push({
      ...participant,
      location: locationData.location || participant.location,
      shipName: shipData.ship || participant.shipName,
      shipTypeId: shipData.shipTypeId || participant.shipTypeId,
      // Keep track of the last known real ship so we can value it after death
      lastShipTypeId: shipData.shipTypeId && shipData.shipTypeId !== 670 
        ? shipData.shipTypeId 
        : (participant.lastShipTypeId || participant.shipTypeId)
    })
  }

  // Determine current global location/ship from the main participant (usually index 0)
  const mainParticipant = updatedParticipants[0]

  const updatedActivity = await prisma.activity.update({
    where: { id: activityId },
    data: {
      participants: updatedParticipants,
      // We sync these fields to the root for easier querying
      region: mainParticipant?.location || activity.region,
      data: {
        ...(activity.data as any) || {},
        lastSyncAt: new Date().toISOString()
      }
    }
  })

  return updatedActivity
})
