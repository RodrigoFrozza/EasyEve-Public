import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/server-logger'
import { esiClient } from '@/lib/esi-client'
import { withErrorHandling } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

const RATE_LIMIT_MS = 20

interface ESIUniverseGroup {
  name: string
  category_id: number
  types: number[]
}

interface ESIUniverseType {
  name: string
  description?: string
  group_id: number
  volume?: number
  packaged_volume?: number
  base_price?: number
  icon_id?: number
  published: boolean
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchWithRetry<T>(url: string, retries = 2): Promise<T | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await esiClient.get(url)
      return res.data as T
    } catch (e: unknown) { 
      // Safe status check
      const status = (e as any)?.response?.status
      if (status === 404) return null
      
      if (i < retries - 1) {
        await delay(300)
      }
    }
  }
  return null
}

export const GET = withErrorHandling(async () => {
  return {
    types: await prisma.eveType.count(),
    groups: await prisma.eveGroup.count(),
    categories: await prisma.eveCategory.count()
  }
})

export const POST = withErrorHandling(async () => {
  const start = Date.now()
  let groupsSaved = 0, typesSaved = 0, errors = 0

  // 1. Fetch ALL group IDs
  const groupIdsRes = await esiClient.get('/universe/groups/')
  const groupIds: number[] = groupIdsRes.data
  logger.info('SyncMarket', `${groupIds.length} groups`)

  // 2. Process first 200 groups with their types
  const batch = groupIds.slice(0, 200)
  
  for (const gid of batch) {
    try {
      const g = await fetchWithRetry<ESIUniverseGroup>(`/universe/groups/${gid}/`)
      if (!g || !g.types?.length) continue

      // Save group
      await prisma.eveGroup.upsert({
        where: { id: gid },
        create: { id: gid, name: g.name || `Group ${gid}`, categoryId: g.category_id },
        update: { name: g.name || `Group ${gid}`, categoryId: g.category_id }
      })
      groupsSaved++

      // Save category
      if (g.category_id) {
        await prisma.eveCategory.upsert({
          where: { id: g.category_id },
          create: { id: g.category_id, name: `Category ${g.category_id}` },
          update: { name: `Category ${g.category_id}` }
        })
      }

      // Save up to 50 types per group
      const typeIds = [...new Set(g.types)].slice(0, 50)
      for (const tid of typeIds) {
        try {
          const t = await fetchWithRetry<ESIUniverseType>(`/universe/types/${tid}/`)
          if (!t?.published) continue

          await prisma.eveType.upsert({
            where: { id: tid },
            create: {
              id: tid,
              name: t.name || `Type ${tid}`,
              description: t.description,
              groupId: t.group_id,
              volume: t.volume || t.packaged_volume,
              basePrice: t.base_price,
              iconId: t.icon_id,
              published: t.published
            },
            update: {
              name: t.name,
              description: t.description,
              volume: t.volume || t.packaged_volume,
              basePrice: t.base_price,
              iconId: t.icon_id,
              published: t.published
            }
          })
          typesSaved++
        } catch { errors++ }
        await delay(RATE_LIMIT_MS)
      }

      await delay(RATE_LIMIT_MS)
      if (groupsSaved % 20 === 0) logger.info('SyncMarket', `${groupsSaved} groups, ${typesSaved} types`)
    } catch { errors++ }
  }

  const duration = Math.round((Date.now() - start) / 1000)
  return { 
    success: true, 
    groups: groupsSaved, 
    types: typesSaved,
    errors,
    duration: `${duration}s`
  }
})