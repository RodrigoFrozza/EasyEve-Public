export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { getValidAccessToken } from '@/lib/token-manager'

interface MiningLedgerEntry {
  date: string
  quantity: number
  type_id: number
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { characterIds, before, after } = body

    if (!characterIds || !Array.isArray(characterIds) || characterIds.length === 0) {
      return NextResponse.json({ error: 'Character IDs are required' }, { status: 400 })
    }

    const results: Record<number, MiningLedgerEntry[]> = {}

    for (const characterId of characterIds) {
      // Verify character belongs to the authenticated user
      const character = await prisma.character.findFirst({
        where: {
          id: characterId,
          userId: user.id,
        },
      })

      if (!character) {
        results[characterId] = []
        continue
      }

      const { accessToken } = await getValidAccessToken(characterId)
      
      if (!accessToken) {
        results[characterId] = []
        continue
      }

      try {
        const allEntries: MiningLedgerEntry[] = []
        let page = 1
        let totalPages = 1

        const params = new URLSearchParams()
        if (before) params.set('before', before)
        if (after) params.set('after', after)

        do {
          const pageParams = new URLSearchParams(params)
          pageParams.set('page', String(page))

          const url = `https://esi.evetech.net/latest/characters/${characterId}/mining/?${pageParams.toString()}`

          const response = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })

          if (!response.ok) break

          const entries: MiningLedgerEntry[] = await response.json()
          allEntries.push(...entries)

          totalPages = parseInt(response.headers.get('X-Pages') || '1', 10)
          page++
        } while (page <= totalPages)

        results[characterId] = allEntries
      } catch (error) {
        console.error(`Error fetching mining ledger for character ${characterId}:`, error)
        results[characterId] = []
      }
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Error fetching mining ledgers:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}