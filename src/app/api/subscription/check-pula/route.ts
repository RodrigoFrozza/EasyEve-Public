import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import axios from 'axios'
import { logger } from '@/lib/server-logger'

const PULALEEROY_CORP_ID = 98651213
const ESI_BASE_URL = 'https://esi.evetech.net/latest'

export async function GET() {
  const component = 'Subscription:CheckPula'
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const userId = session.user.id

    // First, check if we have any cached corporationId in the database
    const characters = await prisma.character.findMany({
      where: { userId },
      select: { id: true, name: true, corporationId: true }
    })

    logger.info(component, `Checking characters for User: ${userId}`, { count: characters.length })

    // Check each character's corporationId in parallel
    const pulas = characters.filter(c => c.corporationId === PULALEEROY_CORP_ID)
    if (pulas.length > 0) {
      logger.info(component, `Found PulaLeeroy in DB for: ${pulas[0].name}`)
      return NextResponse.json({ isPulaLeeroy: true, character: pulas[0], source: 'database' })
    }

    // If no corporationId in DB, fetch fresh data from ESI in parallel
    logger.info(component, 'No corporationId in DB, fetching from ESI in parallel...')
    
    const esiPromises = characters.map(async (char) => {
      try {
        const response = await axios.get(
          `${ESI_BASE_URL}/characters/${char.id}/`,
          {
            params: { datasource: 'tranquility' },
            headers: { 'X-User-Agent': 'EasyEve/1.0.0' }
          }
        )
        return { char, corpId: response.data.corporation_id }
      } catch (esiError) {
        logger.error(component, `ESI fetch failed for ${char.name}`, esiError)
        return { char, corpId: null }
      }
    })

    const esiResults = await Promise.all(esiPromises)
    
    // Find first PulaLeeroy and update DB
    for (const result of esiResults) {
      if (result.corpId === PULALEEROY_CORP_ID) {
        await prisma.character.update({
          where: { id: result.char.id },
          data: { corporationId: PULALEEROY_CORP_ID }
        })
        logger.info(component, `Found PulaLeeroy via ESI for: ${result.char.name}`)
        
        return NextResponse.json({ 
          isPulaLeeroy: true, 
          character: { ...result.char, corporationId: PULALEEROY_CORP_ID }, 
          source: 'esi' 
        })
      }
    }

    return NextResponse.json({ isPulaLeeroy: false, source: 'none' })
  } catch (error) {
    logger.error(component, 'Unexpected error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}