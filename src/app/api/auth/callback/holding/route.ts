import { NextRequest, NextResponse } from 'next/server'
import { parseState, handleLoginFlow, handleLinkFlow } from '@/lib/oauth-handlers'
import { createJWT, createSessionCookie, verifyJWT } from '@/lib/auth-jwt'
import { prisma } from '@/lib/prisma'

/**
 * Specialized callback for Easy-Eve ESI App.
 * This ensures total isolation from the main application flow.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
  const searchParams = request.nextUrl.searchParams

  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[Holding Callback] Error from ESI:', error)
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, baseUrl))
  }

  if (!code) {
    console.error('[Holding Callback] No code provided')
    return NextResponse.redirect(new URL('/login?error=no_code', baseUrl))
  }

  const state = parseState(stateParam)
  const esiApp = 'holding' // Force holding app context for this callback

  // Detect accountCode for linking
  let accountCode = state?.accountCode
  if (!accountCode) {
    const sessionToken = request.cookies.get('session')?.value
    if (sessionToken) {
      const payload = await verifyJWT(sessionToken)
      if (payload?.userId) {
        const existingUser = await prisma.user.findUnique({
          where: { id: payload.userId },
          select: { accountCode: true },
        })
        accountCode = existingUser?.accountCode || undefined
      }
    }
  }

  console.log('[Holding Callback] Processing callback for app: holding...')

  try {
    let result: { userId: string; characterId: number; ownerHash: string; redirectUrl: string }

    if (accountCode) {
      const linkResult = await handleLinkFlow(code, accountCode, baseUrl, esiApp)
      if ('error' in linkResult) {
        return NextResponse.redirect(new URL(linkResult.redirectUrl, baseUrl))
      }
      result = linkResult
    } else {
      result = await handleLoginFlow(code, baseUrl, esiApp)
    }

    const jwt = await createJWT(result.userId, result.characterId, result.ownerHash)
    const cookie = createSessionCookie(jwt)

    // Ensure we redirect back to the admin reconciliation tab
    const finalRedirect = new URL('/dashboard/admin', baseUrl)
    finalRedirect.searchParams.set('tab', 'payments')

    return NextResponse.redirect(
      finalRedirect,
      {
        headers: {
          'Set-Cookie': cookie,
        },
      }
    )

  } catch (err) {
    console.error('[Holding Callback] Fatal Error:', err)
    return NextResponse.redirect(new URL('/login?error=callback_error', baseUrl))
  }
}
