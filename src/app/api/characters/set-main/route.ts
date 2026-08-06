export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const body = await request.json()
    const { characterId } = body
    
    if (!characterId) {
      return NextResponse.json({ error: 'Character ID required' }, { status: 400 })
    }
    
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        userId: user.id
      }
    })
    
    if (!character) {
      return NextResponse.json({ error: 'Character not found' }, { status: 404 })
    }
    
    await prisma.character.updateMany({
      where: { userId: user.id },
      data: { isMain: false }
    })
    
    const updated = await prisma.character.update({
      where: { id: characterId },
      data: { isMain: true }
    })
    
    return NextResponse.json(updated)
  } catch (error) {
    console.error('Set main character error:', error)
    return NextResponse.json({ error: 'Failed to set main character' }, { status: 500 })
  }
}
