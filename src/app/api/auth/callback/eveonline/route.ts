import { NextRequest, NextResponse } from 'next/server'
import { parseState, handleLoginFlow, handleLinkFlow } from '@/lib/oauth-handlers'
import { createJWT, createSessionCookie, verifyJWT } from '@/lib/auth-jwt'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
  const searchParams = request.nextUrl.searchParams

  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const error = searchParams.get('error')

  if (error) {
    console.error('[OAuth Callback] Error from ESI:', error)
    const errorMessages: Record<string, string> = {
      access_denied: 'Login cancelled',
      invalid_request: 'Invalid request',
      temporarily_unavailable: 'ESI temporarily unavailable',
    }
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorMessages[error] || error)}`, baseUrl)
    )
  }

  if (!code) {
    console.error('[OAuth Callback] No code provided')
    return NextResponse.redirect(new URL('/login?error=no_code', baseUrl))
  }

  const state = parseState(stateParam)
  console.log('[OAuth Callback] Raw state param:', stateParam)
  console.log('[OAuth Callback] Parsed state:', JSON.stringify(state))

  // If no accountCode in state, check if the user has an existing session
  // so we can auto-link the new character to their account
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
        if (existingUser?.accountCode) {
          accountCode = existingUser.accountCode
          console.log('[OAuth Callback] Auto-detected session, using accountCode:', accountCode)
        }
      }
    }
  }

  const esiApp = state?.esiApp || 'main'
  console.log('[OAuth Callback] Flow:', accountCode ? 'LINK' : 'LOGIN', 'App:', esiApp)

  try {
    let result: { userId: string; characterId: number; ownerHash: string; redirectUrl: string }

    if (accountCode) {
      console.log('[OAuth Callback] Calling handleLinkFlow...')
      const linkResult = await handleLinkFlow(code, accountCode, baseUrl, esiApp)
      
      if ('error' in linkResult) {
        return NextResponse.redirect(new URL(linkResult.redirectUrl, baseUrl))
      }
      
      result = linkResult
    } else {
      console.log('[OAuth Callback] Calling handleLoginFlow...')
      result = await handleLoginFlow(code, baseUrl, esiApp)
    }

    const jwt = await createJWT(result.userId, result.characterId, result.ownerHash)
    const cookie = createSessionCookie(jwt)

    return NextResponse.redirect(
      new URL(result.redirectUrl, baseUrl),
      {
        headers: {
          'Set-Cookie': cookie,
        },
      }
    )

  } catch (err) {
    console.error('[OAuth Callback] Error:', err)
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('[OAuth Callback] Error details:', errorMessage)
    return NextResponse.redirect(new URL(`/login?error=callback_error&details=${encodeURIComponent(errorMessage)}`, baseUrl))
  }
}
