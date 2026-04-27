import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { isAllowedCharacterTagList } from '@/constants/character-tags'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tags } = await request.json()
    if (!isAllowedCharacterTagList(tags)) {
      return NextResponse.json(
        { error: 'Tags must be an array of allowed activity tag strings' },
        { status: 400 }
      )
    }

    const characterId = parseInt(params.id, 10)

    const character = await prisma.character.findUnique({
      where: { id: characterId }
    })

    if (!character || character.userId !== session.user.id) {
      return NextResponse.json({ error: 'Character not found or access denied' }, { status: 404 })
    }

    const updatedCharacter = await prisma.character.update({
      where: { id: characterId },
      data: { tags }
    })

    return NextResponse.json({ success: true, tags: updatedCharacter.tags })
  } catch (error: any) {
    console.error('Update tags error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
