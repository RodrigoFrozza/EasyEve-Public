import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'
import { refreshAccessToken } from '@/lib/token-manager'

export async function POST() {
  try {
    const characters = await prisma.character.findMany({
      where: {
        refreshToken: { not: null },
        tokenExpiresAt: {
          lte: new Date(Date.now() + 60 * 60 * 1000), // Expires in 1 hour or less
        },
      },
      select: {
        id: true,
        name: true,
        refreshToken: true,
        esiApp: true,
        tokenExpiresAt: true,
      },
    })

    const results = {
      total: characters.length,
      refreshed: 0,
      failed: 0,
      errors: [] as string[],
    }

    for (const char of characters) {
      if (!char.refreshToken) continue

      try {
        const refreshResult = await refreshAccessToken(char.refreshToken, char.esiApp || 'main')
        
        if (refreshResult?.token) {
          const newTokens = refreshResult.token
          const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000)
          
          await prisma.character.update({
            where: { id: char.id },
            data: {
              accessToken: newTokens.access_token,
              refreshToken: newTokens.refresh_token,
              tokenExpiresAt: newExpiresAt,
            },
          })
          
          console.log(`[AutoRefresh] Token refreshed for ${char.name}`)
          results.refreshed++
        } else {
          const error = refreshResult?.error || 'unknown_error'
          console.log(`[AutoRefresh] Failed to refresh for ${char.name}: ${error}`)
          
          // Handle revocation
          if (error === 'invalid_grant' || error === 'token_invalid') {
             await prisma.character.update({
               where: { id: char.id },
               data: { tokenExpiresAt: new Date(1) }
             })
          }

          results.failed++
          results.errors.push(`${char.name}: ${error}`)
        }
      } catch (error: any) {
        console.error(`[AutoRefresh] Error for ${char.name}:`, error.message)
        results.failed++
        results.errors.push(`${char.name}: ${error.message}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Refreshed ${results.refreshed}/${results.total} tokens`,
      ...results,
    })
  } catch (error: any) {
    console.error('[AutoRefresh] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ 
    method: 'POST',
    description: 'Auto-refresh all expiring tokens',
    usage: 'Call this endpoint via cron every 6 hours'
  })
}