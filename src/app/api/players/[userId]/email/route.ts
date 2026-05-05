import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { sendEmailViaESI } from '@/lib/esi/player'
import { z } from 'zod'

const EmailSchema = z.object({
  subject: z.string().min(1).max(1000),
  body: z.string().min(1).max(10000),
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
    const jsonBody = await request.json()
    const emailData = EmailSchema.parse(jsonBody)

    const mainChar = await prisma.character.findFirst({
      where: {
        userId: session.user.id,
        isMain: true,
      },
    })

    if (!mainChar?.accessToken) {
      return NextResponse.json({ error: 'No access token. Please re-authenticate.' }, { status: 401 })
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        characters: {
          where: { isMain: true },
          take: 1,
        },
      },
    })

    if (!targetUser || !targetUser.characters[0]) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const recipientCharacterId = targetUser.characters[0].id

    const success = await sendEmailViaESI(
      mainChar.id,
      mainChar.accessToken,
      [recipientCharacterId],
      emailData.subject,
      emailData.body
    )

    if (!success) {
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[API/players/email] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}