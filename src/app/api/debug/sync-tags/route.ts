import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { prisma } from '@/lib/prisma'

const ESI_BASE_URL = 'https://esi.evetech.net/latest'

// Focus only on Pirate Tags (Cat 17) to be super fast
const PIRATE_TAGS_CATEGORY = 17;
async function fetchESI(path: string) {
  const res = await fetch(`${ESI_BASE_URL}${path}`)
  if (!res.ok) return null
  return res.json()
}

export async function GET() {
  try {
    const categoryId = 17 // Trade Goods
    const results = []

    // Upsert Category
    await prisma.eveCategory.upsert({
      where: { id: categoryId },
      update: { name: 'Trade Goods/Tags' },
      create: { id: categoryId, name: 'Trade Goods/Tags' }
    })

    const groupIds: number[] = await fetchESI(`/universe/categories/${categoryId}/`).then(d => d?.groups || [])
    
    // Vamos sincronizar apenas os primeiros 10 grupos para testar
    for (const groupId of groupIds.slice(0, 15)) {
      const typeIds: number[] = await fetchESI(`/universe/groups/${groupId}/`).then(d => d?.types || [])
      
      await prisma.eveGroup.upsert({
        where: { id: groupId },
        update: { name: `Group ${groupId}`, categoryId: categoryId },
        create: { id: groupId, name: `Group ${groupId}`, categoryId: categoryId }
      })

      for (const typeId of typeIds) {
        const details: any = await fetchESI(`/universe/types/${typeId}/`)
        if (!details || !details.published) continue

        await prisma.eveType.upsert({
          where: { id: typeId },
          update: {
            name: details.name,
            groupId: groupId,
            published: details.published
          },
          create: {
            id: typeId,
            name: details.name,
            groupId: groupId,
            published: details.published
          }
        })
        results.push(details.name)
      }
    }

    return NextResponse.json({ 
      status: 'Success', 
      message: `${results.length} items (Tags) synced successfully!` 
    })
  } catch (error: any) {
    return NextResponse.json({ status: 'Error', error: error.message }, { status: 500 })
  }
}
