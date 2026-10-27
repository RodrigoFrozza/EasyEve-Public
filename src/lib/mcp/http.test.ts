const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn(), delete: jest.fn() },
  character: { findFirst: jest.fn(), findMany: jest.fn() },
  payment: { findMany: jest.fn() },
  activity: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  featureFlag: { findUnique: jest.fn(), findMany: jest.fn(), upsert: jest.fn() },
  securityEvent: { create: jest.fn() },
  $transaction: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma
  },
}))
jest.mock('@/lib/api-helpers', () => ({ getCurrentUser: jest.fn() }))
jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))
jest.mock('@/lib/admin/script-schedules-enrichment', () => ({ getEnrichedSchedulesList: jest.fn() }))

import { handleMcpHttpPost } from './http'

const TOKEN = 'a'.repeat(40)
const AUTH = `Bearer ${TOKEN}`

function post(body: unknown, authorization: string | null = AUTH) {
  return handleMcpHttpPost(authorization, typeof body === 'string' ? body : JSON.stringify(body))
}

async function call(name: string, args: unknown) {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } })
  return (res.json as { result: { content: { text: string }[]; isError?: boolean } }).result
}

describe('MCP HTTP transport', () => {
  const originalToken = process.env.MCP_TOKEN

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.MCP_TOKEN = TOKEN
  })

  afterAll(() => {
    process.env.MCP_TOKEN = originalToken
  })

  describe('auth', () => {
    it('is inert (404) when MCP_TOKEN is unset', async () => {
      delete process.env.MCP_TOKEN
      expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' })).status).toBe(404)
    })

    it('is inert when MCP_TOKEN is a short placeholder, even with a matching header', async () => {
      process.env.MCP_TOKEN = 'changeme'
      expect((await post({ jsonrpc: '2.0', id: 1, method: 'ping' }, 'Bearer changeme')).status).toBe(404)
    })

    it('rejects a missing, wrong or non-Bearer token', async () => {
      const ping = { jsonrpc: '2.0', id: 1, method: 'ping' }
      expect((await post(ping, null)).status).toBe(401)
      expect((await post(ping, `Bearer ${'b'.repeat(40)}`)).status).toBe(401)
      expect((await post(ping, `Basic ${TOKEN}`)).status).toBe(401)
    })
  })

  describe('protocol', () => {
    it('negotiates initialize', async () => {
      const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } })
      const { result } = res.json as { result: Record<string, any> }
      expect(result.protocolVersion).toBe('2025-03-26')
      expect(result.capabilities).toEqual({ tools: { listChanged: false } })
      expect(result.serverInfo.name).toBe('easyeve')
    })

    it('falls back to the latest protocol version for an unknown one', async () => {
      const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1999-01-01' } })
      expect((res.json as any).result.protocolVersion).toBe('2025-06-18')
    })

    it('answers notifications with 202 and no body', async () => {
      const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' })
      expect(res).toEqual({ status: 202 })
    })

    it('returns a JSON-RPC parse error for invalid JSON', async () => {
      const res = await post('{not json')
      expect(res.status).toBe(400)
      expect((res.json as any).error.code).toBe(-32700)
    })

    it('returns method-not-found for unknown methods', async () => {
      const res = await post({ jsonrpc: '2.0', id: 7, method: 'resources/list' })
      expect(res.json).toEqual({
        jsonrpc: '2.0',
        id: 7,
        error: { code: -32601, message: 'Method not found: resources/list' },
      })
    })

    it('lists tools with object input schemas; only the four set_* tools write', async () => {
      const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/list' })
      const { tools } = (res.json as any).result
      expect(tools.map((t: { name: string }) => t.name)).toEqual(
        expect.arrayContaining(['env_info', 'get_user', 'set_feature_flag'])
      )
      for (const tool of tools) {
        expect(tool.inputSchema.type).toBe('object')
        expect(tool.inputSchema.$schema).toBeUndefined()
      }
      const writes = tools.filter((t: any) => !t.annotations.readOnlyHint).map((t: any) => t.name)
      expect(writes.sort()).toEqual([
        'delete_orphan_user',
        'repair_ratting_progress',
        'set_feature_flag',
        'set_news_published',
        'set_promo_banner_active',
        'set_schedule_active',
      ])
    })

    it('handles batched messages', async () => {
      const res = await post([
        { jsonrpc: '2.0', id: 1, method: 'ping' },
        { jsonrpc: '2.0', method: 'notifications/initialized' },
      ])
      expect(res.json).toEqual([{ jsonrpc: '2.0', id: 1, result: {} }])
    })
  })

  describe('tools', () => {
    it('reports an unknown tool as a JSON-RPC error', async () => {
      const res = await post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'drop_db' } })
      expect((res.json as any).error.code).toBe(-32602)
    })

    it('reports invalid arguments as a tool error the model can read', async () => {
      const result = await call('get_user', { userId: 'u1', accountCode: 'X' })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('exactly one of')
    })

    it('get_user never selects token columns', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'Pilot' })
      mockPrisma.character.findMany
        .mockResolvedValueOnce([{ id: 9, name: 'Zeca', tokenExpiresAt: null }])
        .mockResolvedValueOnce([{ id: 9 }])
      mockPrisma.payment.findMany.mockResolvedValue([])
      mockPrisma.activity.findMany.mockResolvedValue([])

      const result = await call('get_user', { userId: 'u1' })
      expect(result.isError).toBeUndefined()
      const body = JSON.parse(result.content[0].text)
      expect(body.characters[0]).toMatchObject({ id: 9, hasRefreshToken: true, accessTokenExpired: true })

      for (const [args] of mockPrisma.character.findMany.mock.calls) {
        for (const column of ['accessToken', 'refreshToken', 'ownerHash', 'shareToken']) {
          expect(args.select?.[column]).toBeUndefined()
        }
        expect(args.include).toBeUndefined()
      }
    })

    it('surfaces a DB failure as a tool error instead of falling back to defaults', async () => {
      mockPrisma.featureFlag.findMany.mockRejectedValue(new Error('connection refused'))
      const result = await call('list_feature_flags', {})
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('connection refused')
    })
  })

  describe('writes', () => {
    it('set_feature_flag is a dry run without confirm', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null)
      const result = await call('set_feature_flag', { name: 'miningLaunchV2', isEnabled: true })
      expect(JSON.parse(result.content[0].text)).toMatchObject({
        dryRun: true,
        changed: false,
        wouldChange: true,
        before: { isEnabled: false, overriddenInDb: false },
      })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
      expect(mockPrisma.featureFlag.upsert).not.toHaveBeenCalled()
    })

    it('set_feature_flag writes and audits in one transaction with confirm', async () => {
      mockPrisma.featureFlag.findUnique.mockResolvedValue(null)
      mockPrisma.featureFlag.upsert.mockReturnValue('upsert-op')
      mockPrisma.securityEvent.create.mockReturnValue('audit-op')
      mockPrisma.$transaction.mockResolvedValue([{ name: 'miningLaunchV2', isEnabled: true, updatedAt: new Date() }, {}])

      const result = await call('set_feature_flag', { name: 'miningLaunchV2', isEnabled: true, confirm: true })
      expect(JSON.parse(result.content[0].text)).toMatchObject({ dryRun: false, changed: true })
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(['upsert-op', 'audit-op'])
      expect(mockPrisma.securityEvent.create.mock.calls[0][0].data).toMatchObject({
        event: 'MCP_WRITE',
        details: { tool: 'set_feature_flag', target: { name: 'miningLaunchV2' } },
      })
    })

    it('set_feature_flag rejects unknown flags', async () => {
      const result = await call('set_feature_flag', { name: 'godMode', isEnabled: true, confirm: true })
      expect(result.isError).toBe(true)
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('delete_orphan_user', () => {
    const orphan = {
      id: 'orphan-1',
      accountCode: 'EVE-74UUUS',
      name: 'Sk4d00sh',
      role: 'user',
      iskBalance: 0,
      subscriptionEnd: null,
      createdAt: new Date('2026-10-15T03:39:38Z'),
      lastLoginAt: new Date('2026-10-15T03:39:38Z'),
      _count: { characters: 0, payments: 0, activities: 0, iskHistory: 0, activationCodes: 0 },
    }

    it('is a dry run without confirm', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(orphan)
      const result = await call('delete_orphan_user', { userId: 'orphan-1' })
      expect(JSON.parse(result.content[0].text)).toMatchObject({ dryRun: true, wouldChange: true })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses an account that holds any data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...orphan, _count: { ...orphan._count, characters: 1 } })
      const result = await call('delete_orphan_user', { userId: 'orphan-1', confirm: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('1 characters')
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('refuses a master or an account with ISK', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...orphan, role: 'master', iskBalance: 5 })
      const result = await call('delete_orphan_user', { userId: 'orphan-1', confirm: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toMatch(/role is master.*iskBalance is 5/)
    })

    it('deletes and audits in one transaction with confirm', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(orphan)
      mockPrisma.user.delete.mockReturnValue('delete-op')
      mockPrisma.securityEvent.create.mockReturnValue('audit-op')
      mockPrisma.$transaction.mockResolvedValue([{}, {}])

      const result = await call('delete_orphan_user', { userId: 'orphan-1', confirm: true })

      expect(JSON.parse(result.content[0].text)).toMatchObject({ dryRun: false, changed: true })
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(['delete-op', 'audit-op'])
      expect(mockPrisma.securityEvent.create.mock.calls[0][0].data.details.before).toMatchObject({
        accountCode: 'EVE-74UUUS',
        name: 'Sk4d00sh',
      })
    })
  })

  describe('repair_ratting_progress', () => {
    const session = {
      id: 'act-1',
      type: 'ratting',
      status: 'active',
      isDeleted: false,
      isPaused: false,
      pausedAt: null as Date | null,
      startTime: new Date('2026-10-19T18:46:40Z'),
      data: {
        logs: [
          { date: '2026-10-20T03:11:45Z', type: 'ess', amount: 1 },
          { date: '2026-10-19T19:21:41Z', type: 'bounty', amount: 1 },
        ],
        lastDataAt: '2026-10-26T17:10:25.710Z',
        lastSyncWithChangesAt: '2026-10-26T17:10:25.710Z',
      },
    }

    it('dry-runs moving progress back to the last income log', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue(session)
      const body = JSON.parse((await call('repair_ratting_progress', { activityId: 'act-1' })).content[0].text)
      expect(body).toMatchObject({
        dryRun: true,
        after: { lastDataAt: '2026-10-20T03:11:45.000Z', lastSyncWithChangesAt: '2026-10-20T03:11:45.000Z' },
      })
      expect(mockPrisma.$transaction).not.toHaveBeenCalled()
    })

    it('also moves pausedAt back when the session was already paused at the inflated instant', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue({
        ...session,
        isPaused: true,
        pausedAt: new Date('2026-10-26T17:10:25.710Z'),
      })
      mockPrisma.activity.update.mockReturnValue('update-op')
      mockPrisma.securityEvent.create.mockReturnValue('audit-op')
      mockPrisma.$transaction.mockResolvedValue([{ isPaused: true, pausedAt: new Date('2026-10-20T03:11:45Z') }, {}])

      await call('repair_ratting_progress', { activityId: 'act-1', confirm: true })

      expect(mockPrisma.$transaction).toHaveBeenCalledWith(['update-op', 'audit-op'])
      expect(mockPrisma.activity.update.mock.calls[0][0].data.pausedAt).toEqual(new Date('2026-10-20T03:11:45Z'))
    })

    it('refuses a session whose progress is not inflated', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue({
        ...session,
        data: { ...session.data, lastDataAt: '2026-10-20T03:30:00Z', lastSyncWithChangesAt: '2026-10-20T03:30:00Z' },
      })
      const result = await call('repair_ratting_progress', { activityId: 'act-1', confirm: true })
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('not inflated')
    })

    it('refuses non-ratting or finished sessions', async () => {
      mockPrisma.activity.findUnique.mockResolvedValue({ ...session, type: 'mining' })
      expect((await call('repair_ratting_progress', { activityId: 'act-1' })).isError).toBe(true)
      mockPrisma.activity.findUnique.mockResolvedValue({ ...session, status: 'completed' })
      expect((await call('repair_ratting_progress', { activityId: 'act-1' })).isError).toBe(true)
    })
  })
})
