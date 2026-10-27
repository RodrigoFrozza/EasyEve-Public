import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getFailureStreak } from '@/lib/scripts/failure-alerts'
import { defineTool } from '../types'
import { pageArgs, pageInput, sinceInput, toPage } from './common'

const WALLET_SYNC_SCRIPT_ID = 'sync-wallet-journal'

export const listPayments = defineTool({
  name: 'list_payments',
  title: 'List payments',
  description:
    'Payment rows (ISK subscription payments synced from the corp wallet journal), newest first, with the paying user. Filter by status (pending/approved/rejected), userId, payer character name (substring) or since.',
  input: z.object({
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
    userId: z.string().optional(),
    payerCharacterName: z.string().min(2).optional(),
    since: sinceInput,
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ status, userId, payerCharacterName, since, limit, cursor }) => {
    const rows = await prisma.payment.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userId ? { userId } : {}),
        ...(payerCharacterName
          ? { payerCharacterName: { contains: payerCharacterName, mode: 'insensitive' as const } }
          : {}),
        ...(since ? { createdAt: { gte: new Date(since) } } : {}),
      },
      include: { user: { select: { id: true, name: true, accountCode: true, subscriptionEnd: true } } },
      ...pageArgs(limit, cursor),
    })
    return toPage(rows, limit)
  },
})

export const paymentSyncStatus = defineTool({
  name: 'payment_sync_status',
  title: 'Payment sync status',
  description:
    'Health of the corp-wallet payment sync: the holding/corp-manager characters it depends on (token expiry, last fetch), the newest payment seen, pending count and payments per day over the last 7 days. A holding character missing or with no recent payments is the known silent-failure mode.',
  input: z.object({}),
  readOnly: true,
  handler: async () => {
    const now = Date.now()
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000)

    const [managers, managersWithRefresh, newestPayment, pending, lastWeek, walletSchedule, lastSuccess] = await Promise.all([
      prisma.character.findMany({
        where: { OR: [{ esiApp: 'holding' }, { isCorpManager: true }] },
        select: {
          id: true,
          name: true,
          esiApp: true,
          isCorpManager: true,
          corporationId: true,
          tokenExpiresAt: true,
          lastFetchedAt: true,
        },
      }),
      prisma.character.findMany({
        where: { OR: [{ esiApp: 'holding' }, { isCorpManager: true }], refreshToken: { not: null } },
        select: { id: true },
      }),
      prisma.payment.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true, createdAt: true, status: true, amount: true } }),
      prisma.payment.count({ where: { status: 'pending' } }),
      prisma.payment.findMany({ where: { createdAt: { gte: weekAgo } }, select: { createdAt: true, status: true } }),
      prisma.scriptSchedule.findFirst({
        where: { scriptId: WALLET_SYNC_SCRIPT_ID },
        select: { id: true, active: true, lastRunAt: true, nextRunAt: true },
      }),
      prisma.scriptExecution.findFirst({
        where: { scriptId: WALLET_SYNC_SCRIPT_ID, status: 'completed' },
        orderBy: { createdAt: 'desc' },
        select: { completedAt: true },
      }),
    ])
    const walletStreak = walletSchedule ? await getFailureStreak(walletSchedule.id) : null

    const withRefresh = new Set(managersWithRefresh.map((m) => m.id))
    const perDay: Record<string, { total: number; approved: number; pending: number; rejected: number }> = {}
    for (const p of lastWeek) {
      const day = p.createdAt.toISOString().slice(0, 10)
      perDay[day] ??= { total: 0, approved: 0, pending: 0, rejected: 0 }
      perDay[day].total += 1
      if (p.status === 'approved' || p.status === 'pending' || p.status === 'rejected') perDay[day][p.status] += 1
    }

    const holding = managers.find((m) => m.esiApp === 'holding')
    return {
      holdingCharacterPresent: !!holding,
      managers: managers.map((m) => ({
        ...m,
        hasRefreshToken: withRefresh.has(m.id),
        accessTokenExpired: !m.tokenExpiresAt || m.tokenExpiresAt.getTime() <= now,
      })),
      walletSyncSchedule: walletSchedule
        ? {
            ...walletSchedule,
            consecutiveFailures: walletStreak?.consecutiveFailures ?? 0,
            lastError: walletStreak?.lastError ?? null,
            // null = no successful run is still on record (executions are pruned by system-maintenance).
            lastSuccessAt: lastSuccess?.completedAt ?? null,
          }
        : null,
      newestPayment,
      pendingPayments: pending,
      paymentsPerDayLast7d: perDay,
    }
  },
})
