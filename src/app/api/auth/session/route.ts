import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { cookies } from 'next/headers'
import { clearSessionCookie } from '@/lib/auth-jwt'

export async function GET() {
  const session = await getSession()
  
  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 })
  }
  
  return NextResponse.json({
    user: {
      id: session.user.id,
      accountCode: session.user.accountCode,
      characterId: session.user.characterId,
      role: session.user.role,
      allowedActivities: session.user.allowedActivities,
      isBlocked: session.user.isBlocked,
      subscriptionEnd: session.user.subscriptionEnd,
      characters: session.user.characters,
    }
  })
}

export async function DELETE() {
  const cookie = clearSessionCookie()
  
  const response = NextResponse.json({ success: true })
  response.headers.set('Set-Cookie', cookie)
  
  return response
}
