import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { z } from 'zod'
import { logger } from '@/lib/server-logger'

const ProfileSettingsSchema = z.object({
  bio: z.string().max(500).optional().nullable(),
  bannerUrl: z.string().url().optional().nullable().or(z.literal("")),
  discordUrl: z.string().optional().nullable(),
  websiteUrl: z.string().url().optional().nullable().or(z.literal("")),
  customThemeColor: z.string().optional().nullable(),
  isPublic: z.boolean().optional(),
  showKills: z.boolean().optional(),
  showDeaths: z.boolean().optional(),
  showReputation: z.boolean().optional(),
  showMedals: z.boolean().optional(),
  showActivities: z.boolean().optional(),
  showFits: z.boolean().optional(),
  showContacts: z.boolean().optional(),
  showLocation: z.boolean().optional(),
  showShip: z.boolean().optional(),
  showWallet: z.boolean().optional(),
  autoTrackingEnabled: z.boolean().optional(),
})

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let profile = await prisma.userProfile.findUnique({
      where: { userId: session.user.id },
    })

    if (!profile) {
      profile = await prisma.userProfile.create({
        data: { userId: session.user.id },
      })
    }

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('[API/players/settings] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const data = ProfileSettingsSchema.parse(body)

    const profile = await prisma.userProfile.upsert({
      where: { userId: session.user.id },
      update: data,
      create: {
        userId: session.user.id,
        ...data,
      },
    })

    logger.info('PrivacySettings', `User ${session.user.id} updated privacy settings`, {
      changedFields: Object.keys(data),
    })

    return NextResponse.json(profile)
  } catch (error: any) {
    console.error('[API/players/settings] Error:', error)
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}