import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

interface RouteParams {
  params: Promise<{ requestId: string }>
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { requestId, action } = body // 'accept' or 'reject'

    // Find the pending request where current user is the contact (they received the request)
    const existingRequest = await prisma.userContact.findFirst({
      where: {
        contactId: session.user.id,
        userId: requestId,
        status: 'pending',
      },
    })

    if (!existingRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (action === 'accept') {
      // Accept: create reciprocal accepted contact
      await prisma.userContact.update({
        where: { id: existingRequest.id },
        data: { status: 'accepted' },
      })

      await prisma.userContact.create({
        data: {
          userId: session.user.id,
          contactId: requestId,
          status: 'accepted',
        },
      })

      // Notify the requester
      const requesterCharacter = await prisma.character.findFirst({
        where: { userId: requestId, isMain: true },
        select: { name: true },
      })

      await prisma.notification.create({
        data: {
          userId: requestId,
          type: 'friend_request',
          title: 'Friend Request Accepted',
          content: `${requesterCharacter?.name || 'A player'} accepted your friend request!`,
          link: `/players/${session.user.id}`,
        },
      })
    } else if (action === 'reject') {
      // Delete the request
      await prisma.userContact.delete({
        where: { id: existingRequest.id },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/contacts/request] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get pending requests where current user is the contact
    const pendingRequests = await prisma.userContact.findMany({
      where: {
        contactId: session.user.id,
        status: 'pending',
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            characters: {
              where: { isMain: true },
              select: { id: true, name: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    const requests = pendingRequests.map(pr => ({
      id: pr.user.id,
      name: pr.user.characters[0]?.name || pr.user.name || 'Unknown',
      characterId: pr.user.characters[0]?.id,
      requestedAt: pr.createdAt,
    }))

    return NextResponse.json({ requests })
  } catch (error: any) {
    console.error('[API/contacts/request] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}