import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { fetchCharacterData } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { withErrorHandling } from '@/lib/api-handler'
import { logger } from '@/lib/server-logger'

export const POST = withErrorHandling(async () => {
  const session = await getSession()
  
  if (!session?.user?.id) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const startedAt = Date.now()
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { characters: true }
    })

    if (!user || user.characters.length === 0) {
      return NextResponse.json({ count: 0, success: true })
    }

    logger.info('Characters', 'Refresh-all sync started', {
      userId: user.id,
      characters: user.characters.length,
    })

    const results = []
    
    // Process characters sequentially to avoid ESI rate issues and reduce peak server load
    for (const char of user.characters) {
      try {
        const { accessToken, error: refreshError } = await getValidAccessToken(char.id)
        
        if (!accessToken) {
          logger.warn('Characters', 'No valid token for character during refresh-all', {
            characterId: char.id,
            characterName: char.name,
            refreshError,
          })
          
          // If the token is specifically invalid (revoked/expired refresh token), mark it as such
          if (refreshError === 'invalid_grant' || refreshError === 'token_invalid') {
             await prisma.character.update({
               where: { id: char.id },
               data: { tokenExpiresAt: new Date(1) } // Use near-zero as a signal for invalid token
             })
          }

          results.push({ id: char.id, success: false, error: refreshError || 'Token refresh failed' })
          continue
        }

        const data = await fetchCharacterData(char.id, accessToken)
        
        await prisma.character.update({
          where: { id: char.id },
          data: {
             name: data.name || char.name,
             totalSp: data.total_sp || char.totalSp,
             walletBalance: data.wallet || char.walletBalance,
             location: data.location || char.location,
             ship: data.ship || char.ship,
             shipTypeId: data.shipTypeId || char.shipTypeId,
             corporationId: data.corporationId || char.corporationId,
             lastFetchedAt: new Date()
          }
        })

        results.push({ id: char.id, success: true })
      } catch (err: any) {
        const message = err instanceof Error ? err.message : 'Refresh failed'
        logger.error('Characters', `Failed to sync character ${char.id}`, err)
        results.push({ id: char.id, success: false, error: message })
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({ 
      count: user.characters.length,
      successCount,
      results,
      durationMs: Date.now() - startedAt,
      success: true 
    })

  } catch (error) {
    logger.error('Characters', 'Refresh-all global failure', error)
    throw new AppError(ErrorCodes.API_SERVER_ERROR, 'Failed to refresh characters', 500)
  }
})
