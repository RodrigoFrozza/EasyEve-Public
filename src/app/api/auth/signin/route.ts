import { NextRequest, NextResponse } from 'next/server'

import { EVE_SCOPES as EVE_SCOPES_LIST, HOLDING_SCOPES as HOLDING_SCOPES_LIST } from '@/lib/constants/scopes'

const EVE_SCOPES = EVE_SCOPES_LIST.join(' ')
const HOLDING_SCOPES = HOLDING_SCOPES_LIST.join(' ')


function generateState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let state = ''
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return state
}

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || request.nextUrl.origin
  
  const linkAccountCode = request.nextUrl.searchParams.get('link')
  const callbackUrl = request.nextUrl.searchParams.get('callbackUrl') || '/dashboard'
  const app = request.nextUrl.searchParams.get('app') || 'main'

  let stateStr: string

  if (linkAccountCode) {
    stateStr = JSON.stringify({
      accountCode: linkAccountCode,
      callbackUrl,
      esiApp: app,
    })
  } else {
    stateStr = JSON.stringify({
      nonce: generateState(),
      esiApp: app,
    })
  }

  const clientId = app === 'holding' ? process.env.HOLDING_EVE_CLIENT_ID : process.env.EVE_CLIENT_ID
  const scopes = app === 'holding' ? HOLDING_SCOPES : EVE_SCOPES
  const endCallback = app === 'holding' ? '/api/auth/callback/holding' : '/api/auth/callback/eveonline'

  console.log(`[OAuth Signin] App: ${app}`)
  console.log(`[OAuth Signin] Client ID: ${clientId}`)
  console.log(`[OAuth Signin] Redirect URI: ${baseUrl}${endCallback}`)

  const url = new URL('https://login.eveonline.com/v2/oauth/authorize')
  url.searchParams.set('client_id', clientId!)
  url.searchParams.set('redirect_uri', `${baseUrl}${endCallback}`)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', scopes)
  url.searchParams.set('state', stateStr)

  return NextResponse.redirect(url.toString())
}
