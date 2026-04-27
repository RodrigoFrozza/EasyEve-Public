export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withCache } from '@/lib/cache'
import { getCorporationWalletJournal } from '@/lib/esi'
import { logger } from '@/lib/server-logger'

/**
 * API Cron Route
 * Securely triggers background tasks.
 * Expects header: x-cron-token: env.CRON_TOKEN
 */

const CRON_SECRET = process.env.CRON_TOKEN

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('x-cron-token')
  
  if (CRON_SECRET && authHeader !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const task = searchParams.get('task')

  try {
    switch (task) {
      case 'sync-prices':
        return await handleSyncPrices()
      case 'clear-cache':
        return await handleClearCache()
      case 'sync-payments':
        return await handleSyncPayments()
      default:
        return NextResponse.json({ 
          error: 'Missing task parameter', 
          available: ['sync-prices', 'clear-cache', 'sync-payments'] 
        }, { status: 400 })
    }
  } catch (error) {
    logger.error('CRON', `Task ${task} failed`, error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

async function handleSyncPrices() {
  const ESI_BASE = 'https://esi.evetech.net/latest'
  
  // Throttle to once per 10 mins
  return withCache('sync-prices-lock', async () => {
    const response = await fetch(`${ESI_BASE}/markets/prices/`, {
      headers: { 'User-Agent': 'EasyEve-Cron/1.0' }
    })
    
    if (!response.ok) throw new Error(`ESI Error: ${response.status}`)
    
    const data = await response.json()
    let updatedCount = 0

    // For EVE SSO specifically, we usually care about specific groups 
    // but here we just update the cache lookup
    const priceMap: Record<number, number> = {}
    for (const item of data) {
      const price = item.adjusted_price || item.average_price || 0
      if (price > 0) {
        priceMap[item.type_id] = price
        updatedCount++
      }
    }

    // Persist to SdeCache for global usage
    await prisma.sdeCache.upsert({
      where: { key: 'market_prices_map' },
      create: {
        key: 'market_prices_map',
        value: priceMap as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24h
      },
      update: {
        value: priceMap as any,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: `Updated ${updatedCount} prices`,
      timestamp: new Date().toISOString()
    })
  }, 10 * 60 * 1000)
}

async function handleClearCache() {
  await prisma.sdeCache.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  })
  return NextResponse.json({ success: true, message: 'Expired cache cleared' })
}

async function handleSyncPayments() {
  // Find a manager character
  const managerChar = await prisma.character.findFirst({
    where: { 
      OR: [
        { esiApp: 'holding' },
        { isCorpManager: true },
        { name: 'Zeca Setaum' }
      ]
    },
    orderBy: { esiApp: 'asc' }
  })

  if (!managerChar) {
    return NextResponse.json({ error: 'No manager character found' }, { status: 404 })
  }

  // Get corp ID
  const charInfoRes = await fetch(`https://esi.evetech.net/latest/characters/${managerChar.id}/`)
  if (!charInfoRes.ok) {
    return NextResponse.json({ error: 'Error fetching corporation ID' }, { status: 502 })
  }
  const charInfo = await charInfoRes.json()
  const corpId = charInfo.corporation_id

  // Fetch journal
  let journal
  try {
    journal = await getCorporationWalletJournal(corpId, managerChar.id)
  } catch (esiErr: unknown) {
    const message = esiErr instanceof Error ? esiErr.message : String(esiErr)
    logger.error('CRON', 'ESI Journal Error', esiErr)
    return NextResponse.json({ error: `ESI Error: ${message}` }, { status: 502 })
  }

  // Process entries
  let newPaymentsCount = 0
  
  for (const entry of journal) {
    const validRefTypes = ['player_donation', 10, 'donation', 8, 'corporation_payment', 15]
    if (!validRefTypes.includes(entry.ref_type)) continue
    if (!entry.amount || entry.amount <= 0) continue 

    const existing = await prisma.payment.findUnique({
      where: { journalId: entry.id.toString() }
    })
    if (existing) continue

    // Resolve user (same logic as admin sync)
    let resolvedUserId: string | null = null
    const accountCodeMatch = entry.description?.match(/EVE-[A-HJ-NP-Z2-9]{6}/i)
    
    if (accountCodeMatch) {
      const userByCode = await prisma.user.findUnique({
        where: { accountCode: accountCodeMatch[0].toUpperCase() },
        select: { id: true }
      })
      if (userByCode) {
        resolvedUserId = userByCode.id
      }
    }

    const payerChar = await prisma.character.findUnique({
      where: { id: entry.first_party_id },
      select: { userId: true, name: true }
    })
    
    if (!resolvedUserId && payerChar?.userId) {
      resolvedUserId = payerChar.userId
    }

    if (!resolvedUserId) {
      const masterUser = await prisma.user.findFirst({ where: { role: 'master' } })
      resolvedUserId = masterUser?.id || ''
    }

    // Create payment and credit ISK
    const payment = await prisma.payment.create({
      data: {
        userId: resolvedUserId,
        amount: entry.amount || 0,
        payerCharacterId: entry.first_party_id,
        payerCharacterName: payerChar?.name || entry.description || 'Unknown Payer',
        journalId: entry.id.toString(),
        status: 'pending',
        createdAt: new Date(entry.date)
      }
    })

    await prisma.user.update({
      where: { id: resolvedUserId },
      data: { iskBalance: { increment: entry.amount || 0 } }
    })

    await prisma.iskHistory.create({
      data: {
        userId: resolvedUserId,
        amount: entry.amount || 0,
        type: 'payment',
        reference: payment.id
      }
    })

    newPaymentsCount++
  }

  // Update global sync timestamp
  await prisma.sdeCache.upsert({
    where: { key: 'last_wallet_sync' },
    create: { key: 'last_wallet_sync', value: { timestamp: new Date().toISOString() } },
    update: { value: { timestamp: new Date().toISOString() } }
  })

  return NextResponse.json({ 
    success: true, 
    newPaymentsCount,
    timestamp: new Date().toISOString()
  })
}
