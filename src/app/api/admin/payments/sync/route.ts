export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { getCorporationWalletJournal } from '@/lib/esi'
import { esiClient } from '@/lib/esi-client'
import { withErrorHandling } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

/**
 * POST /api/admin/payments/sync - Sync corporation wallet journal with payments
 */
export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  // 1. Find a manager character
  // Priority: 1. Character with 'holding' app 2. Marked as isCorpManager 3. Specific CEO name
  const managerChar = await prisma.character.findFirst({
    where: { 
      OR: [
        { esiApp: 'holding' },
        { isCorpManager: true },
        { name: 'Zeca Setaum' }
      ]
    },
    orderBy: {
      esiApp: 'asc' // 'holding' < 'main' alphabetically, 'asc' puts 'holding' first
    }
  })

  if (!managerChar) {
    throw new AppError(
      ErrorCodes.API_NOT_FOUND, 
      'No Corporation Manager character found. Please mark a character as "Corp Manager" in the profile.', 
      404
    )
  }

  // Get character public info to get corp ID
  let charInfoRes
  try {
    charInfoRes = await esiClient.get(`/characters/${managerChar.id}/`)
  } catch (err: unknown) {
    const statusText = err instanceof Error ? err.message : String(err)
    throw new AppError(
      ErrorCodes.ESI_ERROR, 
      `Error querying character from ESI: ${statusText}`, 
      502
    )
  }
  
  const charInfo = charInfoRes.data
  const corpId = charInfo.corporation_id

  if (!corpId) {
    throw new AppError(ErrorCodes.INTERNAL_ERROR, 'Could not determine corporation ID for this character.', 500)
  }

  // 2. Fetch Journal
  let journal
  try {
    journal = await getCorporationWalletJournal(corpId, managerChar.id)
  } catch (esiErr: unknown) {
    const message = esiErr instanceof Error ? esiErr.message : String(esiErr)
    const isScopeError = message.includes('403') || message.includes('Forbidden')
    const isAuthError = message.includes('401') || message.includes('Unauthorized') || message.includes('token')

    if (isAuthError) {
      throw new AppError(
        ErrorCodes.ESI_TOKEN_INVALID,
        `Authorization failed for ${managerChar.name}. Please re-login with this character.`,
        401
      )
    }

    throw new AppError(
      ErrorCodes.ESI_ERROR,
      isScopeError 
        ? `Character ${managerChar.name} lacks the necessary permissions (scopes) to read the corporation journal. Please re-login authorizing all scopes.`
        : `ESI error fetching journal: ${message || 'Unknown error'}`,
      502
    )
  }
  
  // 3. Process entries
  let newPaymentsCount = 0
  
  for (const entry of journal) {
    const validRefTypes = ['player_donation', 10, 'donation', 8, 'corporation_payment', 15]
    if (!validRefTypes.includes(entry.ref_type)) continue
    if (!entry.amount || entry.amount <= 0) continue 

    const existing = await prisma.payment.findUnique({
      where: { journalId: entry.id.toString() }
    })
    if (existing) continue

    // Try to find user by Account Code in description (for alts/unregistered characters)
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

    // Fallback: Find user by registered character
    const payerChar = await prisma.character.findUnique({
      where: { id: entry.first_party_id },
      select: { userId: true, name: true }
    })
    
    if (!resolvedUserId && payerChar?.userId) {
      resolvedUserId = payerChar.userId
    }

    // Final Fallback: Master User (to avoid orphan payments)
    if (!resolvedUserId) {
      const masterUser = await prisma.user.findFirst({ where: { role: 'master' } })
      resolvedUserId = masterUser?.id || ''
    }

    // Create payment and credit ISK in a transaction
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

    // Credit ISK to user's balance (1:1 - same amount as transferred)
    await prisma.user.update({
      where: { id: resolvedUserId },
      data: { iskBalance: { increment: entry.amount || 0 } }
    })

    // Record ISK history
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

  return { 
    success: true, 
    newPaymentsCount,
    manager: managerChar.name,
    corpId
  }
}))
