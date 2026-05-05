import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ESI_BASE_URL, USER_AGENT, ItemInfo } from '@/lib/constants/market'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const typeIdsParam = searchParams.get('typeIds')

    if (!typeIdsParam) {
      return NextResponse.json({ error: 'typeIds required' }, { status: 400 })
    }

    const typeIds = typeIdsParam
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => !isNaN(id) && id > 0)

    if (typeIds.length === 0) {
      return NextResponse.json({ error: 'Invalid typeIds' }, { status: 400 })
    }

    const items = await prisma.eveType.findMany({
      where: { id: { in: typeIds } },
      include: {
        group: {
          include: {
            category: true
          }
        }
      },
      take: typeIds.length
    })

    const foundIds = new Set(items.map((i) => i.id))
    const missing = typeIds.filter((id) => !foundIds.has(id))

    if (missing.length > 0) {
      const missingItems: ItemInfo[] = []
      
      for (const id of missing.slice(0, 10)) {
        try {
          const res = await fetch(
            `${ESI_BASE_URL}/universe/types/${id}/?datasource=tranquility`,
            {
              headers: { 'User-Agent': USER_AGENT }
            }
          )
          if (res.ok) {
            const data = await res.json()
            missingItems.push({
              typeId: data.type_id,
              name: data.name,
              groupId: data.group_id,
              groupName: '',
              categoryId: 0,
              categoryName: '',
              volume: data.packaged_volume || data.volume,
              iconId: data.icon_id,
              published: data.published
            })
          }
        } catch {}
      }

      const allItems = [
        ...items.map((i): ItemInfo => ({
          typeId: i.id,
          name: i.name,
          groupId: i.groupId,
          groupName: i.group?.name || '',
          categoryId: i.group?.categoryId || 0,
          categoryName: i.group?.category?.name || '',
          volume: i.volume || undefined,
          iconId: i.iconId || undefined,
          published: i.published
        })),
        ...missingItems
      ]

      return NextResponse.json({ items: allItems })
    }

    const result: ItemInfo[] = items.map((i) => ({
      typeId: i.id,
      name: i.name,
      groupId: i.groupId,
      groupName: i.group?.name || '',
      categoryId: i.group?.categoryId || 0,
      categoryName: i.group?.category?.name || '',
      volume: i.volume || undefined,
      iconId: i.iconId || undefined,
      published: i.published
    }))

    return NextResponse.json({ items: result })
  } catch (error) {
    console.error('GET /api/market/item error:', error)
    return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
  }
}