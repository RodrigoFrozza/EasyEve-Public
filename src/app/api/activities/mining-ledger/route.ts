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
      const { accessToken } = await getValidAccessToken(characterId)
      
      if (!accessToken) {
        results[characterId] = []
        continue
      }

      try {
        const params = new URLSearchParams()
        if (before) params.set('before', before)
        if (after) params.set('after', after)

        const url = `https://esi.evetech.net/latest/characters/${characterId}/mining/${params.toString() ? '?' + params.toString() : ''}`
        
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })

        if (!response.ok) {
          results[characterId] = []
          continue
        }

        results[characterId] = await response.json()
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