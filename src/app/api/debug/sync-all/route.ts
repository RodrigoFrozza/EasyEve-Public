import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const ESI_BASE_URL = 'https://esi.evetech.net/latest'

// Batch resolve names (MUCH faster)
async function fetchNamesInBulk(ids: number[]) {
  const res = await fetch(`${ESI_BASE_URL}/universe/names/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids)
  })
  if (!res.ok) return []
  return res.json()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    
    console.log(`🚀 Synchronizing Page ${page} of ESI Items...`)

    // 1. Take 1000 item IDs from this page
    const res = await fetch(`${ESI_BASE_URL}/universe/types/?page=${page}`)
    if (!res.ok) {
      return NextResponse.json({ status: 'Finished', message: 'End of the universe reached!' })
    }
    const typeIds: number[] = await res.json()
    
    // 2. Translate 1000 IDs to Names in one batch
    const nameData: { id: number, name: string, category: string }[] = await fetchNamesInBulk(typeIds)
    
    // 3. Ensure "Generic" Group exists (Placeholder while we download details later)
    const genericGroupId = 0 // Using 0 as a temporary placeholder for speed
    await prisma.eveCategory.upsert({
      where: { id: 0 },
      update: { name: 'EVE Universe' },
      create: { id: 0, name: 'EVE Universe' }
    })
    await prisma.eveGroup.upsert({
      where: { id: 0 },
      update: { name: 'Generic Category', categoryId: 0 },
      create: { id: 0, name: 'Generic Category', categoryId: 0 }
    })

    // 4. Bulk insert into DB using transaction for performance
    const upserts = nameData.map(item => {
      // Basic filters: only process inventory items (inventory_type)
      if (item.category !== 'inventory_type') return null
      
      return prisma.eveType.upsert({
        where: { id: item.id },
        update: { name: item.name },
        create: {
          id: item.id,
          name: item.name,
          groupId: 0, // Placeholder
          published: true
        }
      })
    }).filter(Boolean)

    await Promise.all(upserts)

    return NextResponse.json({ 
      status: 'Success', 
      page: page,
      syncedCount: nameData.length,
      nextPage: page + 1,
      message: `Page ${page} (1000 items) synchronized! Visit /api/debug/sync-all?page=${page + 1} to continue.`
    })
  } catch (error: any) {
    return NextResponse.json({ status: 'Error', error: error.message }, { status: 500 })
  }
}
