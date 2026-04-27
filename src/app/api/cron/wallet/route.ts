export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCorporationWalletJournal } from '@/lib/esi'
import { esiClient } from '@/lib/esi-client'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

async function syncCorpWallet(): Promise<{ newPayments: number; error?: string }> {
  const component = 'Cron:WalletSync'
  
  // 1. Find a manager character
  const managerChar = await prisma.character.findFirst({
    where: { 
      OR: [
        { esiApp: 'holding' },
        { isCorpManager: true },
      ]
    },
    orderBy: { esiApp: 'asc' }
  })

  if (!managerChar) {
    return { newPayments: 0, error: 'No Corporation Manager character found' }
  }

  // Get character public info to get corp ID
  let charInfoRes
  try {
    charInfoRes = await esiClient.get(`/characters/${managerChar.id}/`)
  } catch (err) {
    logger.error(component, `ESI error getting character info`, err)
    return { newPayments: 0, error: 'ESI error fetching character' }
  }
  
  const corpId = charInfoRes.data.corporation_id
  if (!corpId) {
    return { newPayments: 0, error: 'Could not determine corporation ID' }
  }

  // Fetch Journal
  let journal
  try {
    journal = await getCorporationWalletJournal(corpId, managerChar.id)
  } catch (esiErr) {
    const message = esiErr instanceof Error ? esiErr.message : String(esiErr)
    return { newPayments: 0, error: `ESI error: ${message}` }
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

    // Resolve user
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

    // Create payment
    await prisma.payment.create({
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

    // Credit ISK
    await prisma.user.update({
      where: { id: resolvedUserId },
      data: { iskBalance: { increment: entry.amount || 0 } }
    })

    newPaymentsCount++
  }

  logger.info(component, `Synced ${newPaymentsCount} new payments`)
  return { newPayments: newPaymentsCount }
}

export async function POST(request: Request) {
  const component = 'Cron:WalletSync'
  
  try {
    // Validate CRON_SECRET
    const cronSecret = request.headers.get('x-cron-secret')
    const expectedSecret = process.env.CRON_SECRET
    
    if (!cronSecret || !expectedSecret) {
      logger.warn(component, 'Missing CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (cronSecret !== expectedSecret) {
      logger.warn(component, 'Invalid CRON_SECRET')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    logger.info(component, 'Starting wallet sync...')

    // Run sync
    const result = await syncCorpWallet()

    if (result.error) {
      logger.error(component, result.error)
      return NextResponse.json({ 
        success: false, 
        error: result.error,
        paymentsFound: 0
      }, { status: 500 })
    }

    // Update cache with last sync time
    const now = new Date().toISOString()
    await prisma.sdeCache.upsert({
      where: { key: 'last_wallet_sync' },
      update: { value: { timestamp: now, payments: result.newPayments } },
      create: { key: 'last_wallet_sync', value: { timestamp: now, payments: result.newPayments } }
    })

    logger.info(component, `Sync complete: ${result.newPayments} new payments`)

    return NextResponse.json({ 
      success: true, 
      paymentsFound: result.newPayments,
      lastSync: now
    })

  } catch (error) {
    logger.error(component, 'Unexpected error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export async function GET() {
  const component = 'Cron:WalletSync'
  
  try {
    // Get last sync info
    const lastSync = await prisma.sdeCache.findUnique({
      where: { key: 'last_wallet_sync' }
    })

    const syncData = lastSync?.value as { timestamp?: string; payments?: number } | null

    return NextResponse.json({
      lastSync: syncData?.timestamp || null,
      paymentsFound: syncData?.payments || 0
    })

  } catch (error) {
    logger.error(component, 'Error fetching sync status', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}