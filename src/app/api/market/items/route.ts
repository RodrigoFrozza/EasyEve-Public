import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

interface GroupItem {
  name: string
  items: { typeId: number; name: string }[]
}

interface SimpleGroup {
  id: number
  name: string
  items: { typeId: number; name: string }[]
}

interface SimpleCategory {
  id: number
  name: string
  children: SimpleGroup[]
}

export async function GET() {
  try {
    const cacheKey = 'market_items_by_group'
    const now = new Date()
    
    const cached = await prisma.sdeCache.findUnique({ where: { key: cacheKey } })
    if (cached && cached.expiresAt && cached.expiresAt > now) {
      return NextResponse.json(cached.value as any)
    }

    const allTypes = await prisma.eveType.findMany({
      where: { published: true },
      select: { id: true, name: true, groupId: true, volume: true, basePrice: true }
    })

    if (allTypes.length === 0) {
      return NextResponse.json({ error: 'No types in database. Run sync first.' }, { status: 404 })
    }

    const groupMap = new Map<number, GroupItem>()
    
    for (const type of allTypes) {
      if (!groupMap.has(type.groupId)) {
        groupMap.set(type.groupId, {
          name: type.name.split(' ').slice(0, 2).join(' ') || `Group ${type.groupId}`,
          items: []
        })
      }
      groupMap.get(type.groupId)!.items.push({
        typeId: type.id,
        name: type.name
      })
    }

    const categoryMap = new Map<string, SimpleCategory>()
    
    for (const [groupId, group] of groupMap) {
      let categoryName = 'Other'
      const firstItems = group.items.slice(0, 3).map(i => i.name.toLowerCase())
      
      if (firstItems.some(n => n.includes('shield') || n.includes('armor') || n.includes('hull'))) {
        categoryName = 'Ship Equipment'
      } else if (firstItems.some(n => n.includes('missile') || n.includes('charge') || n.includes('ammo'))) {
        categoryName = 'Ammunition'
      } else if (firstItems.some(n => n.includes('ship') || n.includes('frigate') || n.includes('cruiser'))) {
        categoryName = 'Ships'
      } else if (firstItems.some(n => n.includes('drone') || n.includes('fighter'))) {
        categoryName = 'Drones'
      } else if (firstItems.some(n => n.includes('skill') || n.includes('learning'))) {
        categoryName = 'Skills'
      } else if (firstItems.some(n => n.includes('implant') || n.includes('booster'))) {
        categoryName = 'Implants'
      } else if (firstItems.some(n => n.includes('ore') || n.includes('mineral') || n.includes('ice'))) {
        categoryName = 'Minerals & Ore'
      } else if (firstItems.some(n => n.includes('module') || n.includes('turret') || n.includes('launcher'))) {
        categoryName = 'Modules'
      }
      
      if (!categoryMap.has(categoryName)) {
        categoryMap.set(categoryName, { id: categoryMap.size + 1, name: categoryName, children: [] })
      }
      
      const sortedItems = [...group.items].sort((a, b) => a.name.localeCompare(b.name))
      categoryMap.get(categoryName)!.children.push({
        id: groupId,
        name: group.name,
        items: sortedItems
      })
    }

    const result: SimpleCategory[] = Array.from(categoryMap.values())
      .map(cat => ({
        ...cat,
        children: [...cat.children].sort((a, b) => a.name.localeCompare(b.name))
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    const cachedValue = { categories: result, total: allTypes.length }
    
    await prisma.sdeCache.upsert({
      where: { key: cacheKey },
      create: { key: cacheKey, value: cachedValue as any, expiresAt: new Date(now.getTime() + 86400000) },
      update: { value: cachedValue as any, expiresAt: new Date(now.getTime() + 86400000) }
    })

    return NextResponse.json(cachedValue)
  } catch (error) {
    console.error('Market items error:', error)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}