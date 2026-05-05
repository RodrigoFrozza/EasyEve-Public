import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const categories = await prisma.eveCategory.findMany({
    take: 50
  })
  
  const asteroidCat = await prisma.eveCategory.findFirst({
    where: { name: { contains: 'Asteroid', mode: 'insensitive' } }
  })
  
  let groupsInAsteroid: any[] = []
  if (asteroidCat) {
    groupsInAsteroid = await prisma.eveGroup.findMany({
      where: { categoryId: asteroidCat.id },
      take: 20
    })
  }

  const vOres = await prisma.eveType.findMany({
     where: { name: { contains: 'Veldspar' } },
     include: { group: { include: { category: true } } },
     take: 5
  })

  return NextResponse.json({
    categories,
    asteroidCat,
    groupsInAsteroid,
    vOres
  })
}
