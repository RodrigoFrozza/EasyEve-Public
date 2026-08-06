import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const ores = await prisma.eveType.findMany({
      where: { 
        published: true,
        group: {
          category: { id: 25 }
        }
      },
      orderBy: { basePrice: 'desc' },
      take: 20,
      include: { group: true }
    })

    const formatted = ores.map(ore => ({
      name: ore.name,
      valuePerUnit: ore.basePrice || 0,
      groupName: ore.group.name,
      volume: ore.volume,
    }))

    return NextResponse.json(formatted)
  } catch (error: any) {
    console.error('Failed to fetch valuable ores:', error)
    if (error && typeof error === 'object') {
      console.error('Prisma Error Details:', {
        message: error.message,
        code: error.code,
        meta: error.meta
      })
    }
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message || 'Unknown error'
    }, { status: 500 })
  }
}