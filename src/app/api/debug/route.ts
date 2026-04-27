import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'master') {
    throw new AppError(ErrorCodes.API_FORBIDDEN, 'Admin access required', 403)
  }
  
  try {
    const samples = await prisma.shipStats.findMany({
      take: 20,
      select: {
        name: true,
        factionName: true,
        groupName: true
      }
    })
    return NextResponse.json(samples)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
