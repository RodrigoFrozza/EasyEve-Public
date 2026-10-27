import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { REVOKED_TOKEN_SENTINEL_MS, isTokenRevoked } from '@/lib/characters/token-revocation'
import { defineTool, McpToolError } from '../types'
import { pageArgs, pageInput, toPage } from './common'

/**
 * Character columns safe to expose. accessToken, refreshToken, ownerHash and
 * shareToken are deliberately absent — every Character read in the MCP goes
 * through this select, so those columns are never loaded.
 */
export const SAFE_CHARACTER_SELECT = {
  id: true,
  name: true,
  userId: true,
  isMain: true,
  esiApp: true,
  isCorpManager: true,
  corporationId: true,
  totalSp: true,
  walletBalance: true,
  location: true,
  ship: true,
  isOmega: true,
  tokenExpiresAt: true,
  lastFetchedAt: true,
  createdAt: true,
} satisfies Prisma.CharacterSelect

const USER_SUMMARY_SELECT = {
  id: true,
  accountCode: true,
  name: true,
  role: true,
  allowedActivities: true,
  isBlocked: true,
  blockedAt: true,
  blockReason: true,
  subscriptionEnd: true,
  iskBalance: true,
  isTester: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { characters: true } },
} satisfies Prisma.UserSelect

/** Character ids (of the given set) that hold a refresh token — without reading it. */
async function idsWithRefreshToken(characterIds: number[]): Promise<Set<number>> {
  if (characterIds.length === 0) return new Set()
  const rows = await prisma.character.findMany({
    where: { id: { in: characterIds }, refreshToken: { not: null } },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
}

export const findUsers = defineTool({
  name: 'find_users',
  title: 'Find users',
  description:
    'Search users by name, account code, user id or character name (case-insensitive substring), with optional filters. Returns account summaries without email or Discord ids.',
  input: z.object({
    query: z.string().min(2).optional().describe('Matches user name, accountCode, user id or any character name'),
    role: z.enum(['master', 'user']).optional(),
    blocked: z.boolean().optional(),
    tester: z.boolean().optional(),
    subscriptionActive: z.boolean().optional().describe('true = subscriptionEnd in the future'),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ query, role, blocked, tester, subscriptionActive, limit, cursor }) => {
    const now = new Date()
    const where: Prisma.UserWhereInput = {
      ...(role ? { role } : {}),
      ...(blocked !== undefined ? { isBlocked: blocked } : {}),
      ...(tester !== undefined ? { isTester: tester } : {}),
      ...(subscriptionActive === true ? { subscriptionEnd: { gt: now } } : {}),
      ...(subscriptionActive === false
        ? { OR: [{ subscriptionEnd: null }, { subscriptionEnd: { lte: now } }] }
        : {}),
    }
    if (query) {
      where.AND = [
        {
          OR: [
            { id: query },
            { name: { contains: query, mode: 'insensitive' } },
            { accountCode: { contains: query, mode: 'insensitive' } },
            { characters: { some: { name: { contains: query, mode: 'insensitive' } } } },
          ],
        },
      ]
    }
    const rows = await prisma.user.findMany({ where, select: USER_SUMMARY_SELECT, ...pageArgs(limit, cursor) })
    return toPage(rows, limit)
  },
})

export const getUser = defineTool({
  name: 'get_user',
  title: 'Get user',
  description:
    'Full picture of one user: account, characters (token status as booleans, never the tokens), last 10 payments and last 10 activities. Identify by exactly one of userId, accountCode, characterId or characterName (exact).',
  input: z
    .object({
      userId: z.string().optional(),
      accountCode: z.string().optional(),
      characterId: z.number().int().optional(),
      characterName: z.string().optional(),
    })
    .refine((v) => Object.values(v).filter((x) => x !== undefined).length === 1, {
      message: 'Pass exactly one of userId, accountCode, characterId, characterName',
    }),
  readOnly: true,
  handler: async ({ userId, accountCode, characterId, characterName }) => {
    let resolvedId = userId
    if (accountCode) {
      resolvedId = (await prisma.user.findUnique({ where: { accountCode }, select: { id: true } }))?.id
    } else if (characterId !== undefined || characterName) {
      const character = await prisma.character.findFirst({
        where: characterId !== undefined ? { id: characterId } : { name: { equals: characterName, mode: 'insensitive' } },
        select: { userId: true },
      })
      resolvedId = character?.userId
    }
    if (!resolvedId) throw new McpToolError('User not found')

    const user = await prisma.user.findUnique({ where: { id: resolvedId }, select: USER_SUMMARY_SELECT })
    if (!user) throw new McpToolError('User not found')

    const [characters, payments, activities] = await Promise.all([
      prisma.character.findMany({
        where: { userId: resolvedId },
        select: SAFE_CHARACTER_SELECT,
        orderBy: [{ isMain: 'desc' }, { name: 'asc' }],
      }),
      prisma.payment.findMany({
        where: { userId: resolvedId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.activity.findMany({
        where: { userId: resolvedId, isDeleted: false },
        select: {
          id: true,
          type: true,
          status: true,
          characterId: true,
          startTime: true,
          endTime: true,
          isPaused: true,
          region: true,
          space: true,
        },
        orderBy: { startTime: 'desc' },
        take: 10,
      }),
    ])
    const withRefresh = await idsWithRefreshToken(characters.map((c) => c.id))
    const now = Date.now()

    return {
      user,
      characters: characters.map((c) => ({
        ...c,
        hasRefreshToken: withRefresh.has(c.id),
        tokenRevoked: isTokenRevoked(c.tokenExpiresAt),
        accessTokenExpired: !c.tokenExpiresAt || c.tokenExpiresAt.getTime() <= now,
      })),
      recentPayments: payments,
      recentActivities: activities,
    }
  },
})

export const characterTokenHealth = defineTool({
  name: 'character_token_health',
  title: 'Character token health',
  description:
    'ESI token health across all characters: totals per esiApp, characters whose token was revoked (refresh failed with invalid_grant — owner must log in again), characters without a refresh token, and characters whose access token has not been renewed in staleHours (background refresh stopped). Lists up to 50 of each problem. lastFetchedAt is only the last profile refresh, not a sync signal.',
  input: z.object({
    staleHours: z.number().int().min(1).max(24 * 30).default(24),
  }),
  readOnly: true,
  handler: async ({ staleHours }) => {
    const revokedSentinel = new Date(REVOKED_TOKEN_SENTINEL_MS)
    const revokedWhere: Prisma.CharacterWhereInput = { tokenExpiresAt: { lte: revokedSentinel } }
    // Access tokens last ~20min and are renewed in the background, so an
    // expiry far in the past (but not the revoked sentinel) means renewal stopped.
    const staleWhere: Prisma.CharacterWhereInput = {
      refreshToken: { not: null },
      tokenExpiresAt: { gt: revokedSentinel, lt: new Date(Date.now() - staleHours * 60 * 60 * 1000) },
    }
    const listSelect = {
      id: true,
      name: true,
      userId: true,
      esiApp: true,
      lastFetchedAt: true,
      tokenExpiresAt: true,
    } satisfies Prisma.CharacterSelect

    const [byApp, revokedCount, revoked, missingCount, missing, staleCount, stale] = await Promise.all([
      prisma.character.groupBy({ by: ['esiApp'], _count: { _all: true } }),
      prisma.character.count({ where: revokedWhere }),
      prisma.character.findMany({ where: revokedWhere, select: listSelect, take: 50, orderBy: { name: 'asc' } }),
      prisma.character.count({ where: { refreshToken: null } }),
      prisma.character.findMany({ where: { refreshToken: null }, select: listSelect, take: 50, orderBy: { name: 'asc' } }),
      prisma.character.count({ where: staleWhere }),
      prisma.character.findMany({ where: staleWhere, select: listSelect, take: 50, orderBy: { tokenExpiresAt: 'asc' } }),
    ])

    return {
      totalsByEsiApp: Object.fromEntries(byApp.map((g) => [g.esiApp, g._count._all])),
      revoked: { count: revokedCount, characters: revoked },
      withoutRefreshToken: { count: missingCount, characters: missing },
      tokenNotRenewed: { staleHours, count: staleCount, characters: stale },
    }
  },
})
