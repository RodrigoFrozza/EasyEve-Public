import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = 50 // Increased pageSize to handle more contacts at once for the social panel

    const allContacts = await prisma.userContact.findMany({
      where: {
        OR: [
          { userId: session.user.id },
          { contactId: session.user.id }
        ]
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            isTester: true,
            lastLoginAt: true,
            characters: {
              where: { isMain: true },
              select: { id: true, name: true },
              take: 1,
            },
            activities: {
              where: { status: 'active' },
              orderBy: { startTime: 'desc' },
              take: 1,
            },
          }
        },
        contact: {
          select: {
            id: true,
            name: true,
            isTester: true,
            lastLoginAt: true,
            characters: {
              where: { isMain: true },
              select: { id: true, name: true },
              take: 1,
            },
            activities: {
              where: { status: 'active' },
              orderBy: { startTime: 'desc' },
              take: 1,
            },
          }
        }
      }
    }) as any[]

    const userActiveActivity = await prisma.activity.findFirst({
      where: {
        userId: session.user.id,
        status: 'active',
      },
      orderBy: { startTime: 'desc' },
    })

    const contactsMap = new Map<string, any>()
    const pendingReceivedMap = new Map<string, any>()
    const pendingSentMap = new Map<string, any>()

    for (const uc of allContacts) {
      const isRequester = uc.userId === session.user.id
      const otherUser = isRequester ? uc.contact : uc.user
      
      const isOnline = otherUser.lastLoginAt && 
        new Date(otherUser.lastLoginAt).getTime() > Date.now() - 30 * 60 * 1000

      const contactData = {
        id: otherUser.id,
        contactId: uc.id, // The UserContact record ID
        name: otherUser.characters[0]?.name || otherUser.name || 'Unknown',
        isOnline,
        isTester: otherUser.isTester,
        mainCharacterId: otherUser.characters[0]?.id,
        activeActivity: otherUser.activities[0] ? {
          type: otherUser.activities[0].type,
        } : null,
        updatedAt: uc.updatedAt
      }

      if (uc.status === 'accepted') {
        const existing = contactsMap.get(otherUser.id)
        if (!existing || new Date(uc.updatedAt) > new Date(existing.updatedAt)) {
          contactsMap.set(otherUser.id, contactData)
        }
      } else if (uc.status === 'pending') {
        if (isRequester) {
          const existing = pendingSentMap.get(otherUser.id)
          if (!existing || new Date(uc.updatedAt) > new Date(existing.updatedAt)) {
            pendingSentMap.set(otherUser.id, contactData)
          }
        } else {
          const existing = pendingReceivedMap.get(otherUser.id)
          if (!existing || new Date(uc.updatedAt) > new Date(existing.updatedAt)) {
            pendingReceivedMap.set(otherUser.id, contactData)
          }
        }
      }
    }

    const contacts = Array.from(contactsMap.values())
    const pendingReceived = Array.from(pendingReceivedMap.values())
    const pendingSent = Array.from(pendingSentMap.values())

    // Sort: Online first, then by name
    contacts.sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1
      if (!a.isOnline && b.isOnline) return 1
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      contacts,
      pendingReceived,
      pendingSent,
      userActivity: userActiveActivity ? {
        type: userActiveActivity.type,
        startTime: userActiveActivity.startTime,
      } : null,
    })
  } catch (error: any) {
    console.error('[API/players/contacts] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}