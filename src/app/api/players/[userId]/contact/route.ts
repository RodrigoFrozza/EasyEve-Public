import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ userId: string }>
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot add yourself as contact' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingContact = await prisma.userContact.findFirst({
      where: {
        OR: [
          { userId: session.user.id, contactId: userId },
          { userId: userId, contactId: session.user.id },
        ],
      },
    })

    if (existingContact) {
      return NextResponse.json({ error: 'Contact already exists' }, { status: 400 })
    }

    // Check if other user already has a pending request from us
    const existingRequest = await prisma.userContact.findFirst({
      where: {
        OR: [
          { userId: session.user.id, contactId: userId },
          { userId: userId, contactId: session.user.id },
        ],
      },
    })

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return NextResponse.json({ error: 'Friend request already pending' }, { status: 400 })
      }
      return NextResponse.json({ error: 'Already friends' }, { status: 400 })
    }

    // Create pending friend request
    const contact = await prisma.userContact.create({
      data: {
        userId: session.user.id,
        contactId: userId,
        status: 'pending',
      },
    })

    // Create notification for target user
    const targetCharacter = await prisma.character.findFirst({
      where: { userId: session.user.id, isMain: true },
      select: { name: true },
    })

    await prisma.notification.create({
      data: {
        userId: userId,
        type: 'friend_request',
        title: 'Friend Request',
        content: `${targetCharacter?.name || 'A player'} wants to add you as a contact`,
        link: `/players/${session.user.id}`,
      },
    })

    return NextResponse.json({ success: true, pending: true, contactId: contact.id })
  } catch (error: any) {
    console.error('[API/players/contact] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params

    await prisma.userContact.deleteMany({
      where: {
        userId: session.user.id,
        contactId: userId,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/players/contact] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}