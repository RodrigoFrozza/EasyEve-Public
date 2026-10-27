import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { locale, accentColor, notificationEmail, notificationSkills, notificationMarket } = body

    const updateData: {
      locale?: string
      accentColor?: string
      notificationEmail?: boolean
      notificationSkills?: boolean
      notificationMarket?: boolean
    } = {}

    if (locale !== undefined) updateData.locale = locale
    if (accentColor !== undefined) updateData.accentColor = accentColor
    if (notificationEmail !== undefined) updateData.notificationEmail = notificationEmail
    if (notificationSkills !== undefined) updateData.notificationSkills = notificationSkills
    if (notificationMarket !== undefined) updateData.notificationMarket = notificationMarket

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No preferences provided' }, { status: 400 })
    }

    await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: updateData,
      create: {
        userId: session.user.id,
        ...updateData,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Preferences PUT error:', error)
    return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        locale: true,
        accentColor: true,
        notificationEmail: true,
        notificationSkills: true,
        notificationMarket: true,
      }
    })

    return NextResponse.json({
      locale: profile?.locale || 'en',
      accentColor: profile?.accentColor || 'cyan',
      notificationEmail: profile?.notificationEmail ?? true,
      notificationSkills: profile?.notificationSkills ?? false,
      notificationMarket: profile?.notificationMarket ?? false,
    })
  } catch (error) {
    console.error('Preferences GET error:', error)
    return NextResponse.json({ error: 'Failed to fetch preferences' }, { status: 500 })
  }
}