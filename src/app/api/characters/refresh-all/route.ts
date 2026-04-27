import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { fetchCharacterData } from '@/lib/esi'
import { getValidAccessToken } from '@/lib/token-manager'

export async function POST() {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { characters: true }
    })

    if (!user || user.characters.length === 0) {
      return NextResponse.json({ count: 0, success: true })
    }

    console.log(`[Refresh-All] Starting sync for ${user.characters.length} characters of user ${user.id}`)

    const results = []
    
    // Process characters sequentially to avoid ESI rate issues and reduce peak server load
    for (const char of user.characters) {
      try {
        const { accessToken, error: refreshError } = await getValidAccessToken(char.id)
        
        if (!accessToken) {
          console.warn(`[Refresh-All] No valid token for character ${char.name} (${char.id})`)
          
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
        console.error(`[Refresh-All] Failed to sync character ${char.id}:`, err.message)
        results.push({ id: char.id, success: false, error: err.message })
      }
    }

    const successCount = results.filter(r => r.success).length
    
    return NextResponse.json({ 
      count: user.characters.length,
      successCount,
      results,
      success: true 
    })

  } catch (error: any) {
    console.error('[Refresh-All] Global Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
