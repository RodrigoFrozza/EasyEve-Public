import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { toast } from 'sonner'

const SendMessageSchema = z.object({
  content: z.string().min(1).max(5000),
})

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
    const body = await request.json()
    const { content } = SendMessageSchema.parse(body)

    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot send message to yourself' }, { status: 400 })
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } })
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const isContact = await prisma.userContact.findFirst({
      where: {
        userId: session.user.id,
        contactId: userId,
        status: 'accepted',
      },
    })

    if (!isContact) {
      return NextResponse.json({ error: 'You can only message contacts' }, { status: 403 })
    }

    const message = await prisma.playerMessage.create({
      data: {
        senderId: session.user.id,
        receiverId: userId,
        content,
      },
    })

    await prisma.notification.create({
      data: {
        userId,
        type: 'message',
        title: 'New message',
        content: `You received a message from a contact`,
        link: `/messages/${message.id}`,
      },
    })

    return NextResponse.json({ success: true, messageId: message.id })
  } catch (error: any) {
    console.error('[API/players/message] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = 20

    const messages = await prisma.playerMessage.findMany({
      where: {
        OR: [
          { senderId: session.user.id, receiverId: userId },
          { senderId: userId, receiverId: session.user.id },
        ],
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    })

    await prisma.playerMessage.updateMany({
      where: {
        senderId: userId,
        receiverId: session.user.id,
        isRead: false,
      },
      data: { isRead: true },
    })

    return NextResponse.json({ messages })
  } catch (error: any) {
    console.error('[API/players/message] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}