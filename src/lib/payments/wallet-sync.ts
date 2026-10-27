import { prisma } from '@/lib/prisma'
import { getCorporationWalletJournal } from '@/lib/esi'
import { esiClient } from '@/lib/esi-client'
import { logger } from '@/lib/server-logger'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { extractAccountCode } from '@/lib/account-code'

/**
 * The one corp-wallet → Payment sync, used by both the admin "Sync wallet"
 * button (POST /api/admin/payments/sync) and the scheduled sync-wallet-journal
 * script. They used to be two copies that drifted: different manager lookup
 * (one had a hard-coded character name), different ESI error messages, ISK
 * history inside vs. outside the transaction, and only one recorded the last
 * sync. Both silently credited unmatched donations to the master account.
 *
 * Money flow is unchanged: a new donation becomes a 'pending' Payment and is
 * credited to the payer's iskBalance at once (approve/reject/link act on it
 * later). A donation that cannot be matched to a user is still parked on the
 * master account so no ISK goes missing — but it is now flagged
 * `needsReview` and every master is told through the bell.
 */

const DONATION_REF_TYPES: Array<string | number> = ['player_donation', 10, 'donation', 8, 'corporation_payment', 15]

export interface WalletSyncResult {
  newPaymentsCount: number
  needsReviewCount: number
  manager: string
  corpId: number
}

interface JournalEntry {
  id: number | string
  ref_type: string | number
  amount?: number
  first_party_id: number
  reason?: string
  description?: string
  date: string
}

const FIX_MANAGER =
  'Fix: while logged in as admin, open /api/auth/signin?app=holding and log in the corp CEO character ' +
  'through the Holding app, then run the wallet sync.'

async function findManagerCharacter() {
  const manager = await prisma.character.findFirst({
    where: { OR: [{ esiApp: 'holding' }, { isCorpManager: true }] },
    // 'holding' sorts before 'main': the Holding-app login (corp wallet scopes) wins.
    orderBy: { esiApp: 'asc' },
    select: { id: true, name: true },
  })
  if (!manager) {
    // Actionable on purpose: this message reaches the bell and the admin
    // Schedules alert (failure-alerts.ts), so it has to say how to fix it.
    throw new AppError(
      ErrorCodes.API_NOT_FOUND,
      `No Corporation Manager character found: no character has esiApp=holding or isCorpManager. Payments are NOT being synced. ${FIX_MANAGER}`,
      404
    )
  }
  return manager
}

async function fetchJournal(manager: { id: number; name: string }) {
  let corpId: number | undefined
  try {
    const info = await esiClient.get(`/characters/${manager.id}/`)
    corpId = info.data?.corporation_id
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new AppError(ErrorCodes.ESI_ERROR, `Error querying character ${manager.name} from ESI: ${msg}`, 502)
  }
  if (!corpId) {
    throw new AppError(ErrorCodes.INTERNAL_ERROR, `Could not determine the corporation of ${manager.name}.`, 500)
  }

  try {
    const journal = (await getCorporationWalletJournal(corpId, manager.id)) as JournalEntry[]
    return { corpId, journal }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('token')) {
      throw new AppError(
        ErrorCodes.ESI_TOKEN_INVALID,
        `Authorization failed for ${manager.name}: the token was revoked or expired (${msg}). ${FIX_MANAGER}`,
        401
      )
    }
    if (msg.includes('403') || msg.includes('Forbidden')) {
      throw new AppError(
        ErrorCodes.ESI_ERROR,
        `${manager.name} lacks the scopes to read the corporation wallet journal (or is no longer a director/CEO). ${FIX_MANAGER}`,
        502
      )
    }
    throw new AppError(ErrorCodes.ESI_ERROR, `ESI error fetching the corp wallet journal: ${msg || 'unknown error'}`, 502)
  }
}

/** userId the donation belongs to, or null when nothing ties it to a user. */
async function resolvePayer(entry: JournalEntry) {
  const payerChar = await prisma.character.findUnique({
    where: { id: entry.first_party_id },
    select: { userId: true, name: true },
  })

  // The payer's typed note (with the account code) lives in `reason`;
  // `description` is CCP's auto text — scan both. The code wins over the
  // character so alts and unregistered characters can pay for an account.
  const accountCode = extractAccountCode(entry.reason, entry.description)
  if (accountCode) {
    const byCode = await prisma.user.findUnique({ where: { accountCode }, select: { id: true } })
    if (byCode) return { userId: byCode.id, payerName: payerChar?.name }
  }
  return { userId: payerChar?.userId ?? null, payerName: payerChar?.name }
}

export async function syncCorpWalletPayments(): Promise<WalletSyncResult> {
  const manager = await findManagerCharacter()
  const { corpId, journal } = await fetchJournal(manager)

  let master: { id: string } | null | undefined
  let newPaymentsCount = 0
  let needsReviewCount = 0

  for (const entry of journal) {
    if (!DONATION_REF_TYPES.includes(entry.ref_type)) continue
    if (!entry.amount || entry.amount <= 0) continue

    const journalId = entry.id.toString()
    const existing = await prisma.payment.findUnique({ where: { journalId }, select: { id: true } })
    if (existing) continue

    const { userId: payerUserId, payerName } = await resolvePayer(entry)
    let userId = payerUserId
    const needsReview = !userId
    if (!userId) {
      if (master === undefined) {
        master = await prisma.user.findFirst({ where: { role: 'master' }, select: { id: true } })
      }
      if (!master) {
        throw new AppError(
          ErrorCodes.INTERNAL_ERROR,
          `Donation ${journalId} could not be matched to a user and there is no master account to park it on.`,
          500
        )
      }
      userId = master.id
    }

    const amount = entry.amount
    // Payment, balance credit and ISK history commit together: a crash midway
    // must never leave a payment without its credit (or the reverse).
    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          userId: userId as string,
          amount,
          payerCharacterId: entry.first_party_id,
          payerCharacterName: payerName || entry.description || 'Unknown Payer',
          journalId,
          status: 'pending',
          needsReview,
          createdAt: new Date(entry.date),
        },
      })
      await tx.user.update({ where: { id: userId as string }, data: { iskBalance: { increment: amount } } })
      await tx.iskHistory.create({
        data: { userId: userId as string, amount, type: 'payment', reference: payment.id },
      })
    })

    newPaymentsCount++
    if (needsReview) needsReviewCount++
  }

  if (needsReviewCount > 0) await notifyMastersOfUnmatched(needsReviewCount)

  await prisma.sdeCache.upsert({
    where: { key: 'last_wallet_sync' },
    update: { value: { timestamp: new Date().toISOString(), payments: newPaymentsCount, needsReview: needsReviewCount } },
    create: { key: 'last_wallet_sync', value: { timestamp: new Date().toISOString(), payments: newPaymentsCount, needsReview: needsReviewCount } },
  })

  logger.info('WalletSync', `Synced ${newPaymentsCount} new payment(s), ${needsReviewCount} need review`, {
    manager: manager.name,
    corpId,
  })
  return { newPaymentsCount, needsReviewCount, manager: manager.name, corpId }
}

async function notifyMastersOfUnmatched(count: number) {
  try {
    const masters = await prisma.user.findMany({ where: { role: 'master' }, select: { id: true } })
    await prisma.notification.createMany({
      data: masters.map((m) => ({
        userId: m.id,
        type: 'payment',
        title: `${count} pagamento(s) sem vínculo para revisar`,
        content:
          'Doação sem código de conta e de personagem não cadastrado: o ISK foi creditado provisoriamente no master. ' +
          'Abra Pagamentos e vincule cada um ao usuário certo.',
        link: '/dashboard/admin/finance/payments',
      })),
    })
  } catch (error) {
    // The payments are flagged needsReview either way; the bell is a courtesy.
    logger.error('WalletSync', 'Failed to notify masters about unmatched payments', error)
  }
}
