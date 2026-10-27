const tx = {
  payment: { create: jest.fn() },
  user: { update: jest.fn() },
  iskHistory: { create: jest.fn() },
}

const mockPrisma = {
  character: { findFirst: jest.fn(), findUnique: jest.fn() },
  user: { findUnique: jest.fn(), findFirst: jest.fn(), findMany: jest.fn() },
  payment: { findUnique: jest.fn() },
  notification: { createMany: jest.fn() },
  sdeCache: { upsert: jest.fn() },
  $transaction: jest.fn(),
}

jest.mock('@/lib/prisma', () => ({
  get prisma() {
    return mockPrisma
  },
}))
const mockJournal = jest.fn()
jest.mock('@/lib/esi', () => ({ getCorporationWalletJournal: (...a: unknown[]) => mockJournal(...a) }))
const mockEsiGet = jest.fn()
jest.mock('@/lib/esi-client', () => ({ esiClient: { get: (...a: unknown[]) => mockEsiGet(...a) } }))
jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { syncCorpWalletPayments } from './wallet-sync'

const donation = (over: Record<string, unknown> = {}) => ({
  id: 26200000001,
  ref_type: 'player_donation',
  amount: 100_000_000,
  first_party_id: 2115681918,
  reason: '',
  description: 'Brutus Kobalt deposited cash into Easy Eve Holding\'s account',
  date: '2026-10-26T18:00:00Z',
  ...over,
})

describe('syncCorpWalletPayments', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma.character.findFirst.mockResolvedValue({ id: 2124392384, name: 'Fleet Citizen 07' })
    mockEsiGet.mockResolvedValue({ data: { corporation_id: 98826336 } })
    mockPrisma.payment.findUnique.mockResolvedValue(null)
    mockPrisma.character.findUnique.mockResolvedValue(null)
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.findFirst.mockResolvedValue({ id: 'master-1' })
    mockPrisma.user.findMany.mockResolvedValue([{ id: 'master-1' }])
    mockPrisma.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx))
    tx.payment.create.mockResolvedValue({ id: 'pay-1' })
  })

  it('fails with an actionable message when no manager character exists', async () => {
    mockPrisma.character.findFirst.mockResolvedValue(null)
    await expect(syncCorpWalletPayments()).rejects.toThrow(/No Corporation Manager character found.*app=holding/)
    expect(mockJournal).not.toHaveBeenCalled()
  })

  it('never falls back to a hard-coded character name', async () => {
    mockPrisma.character.findFirst.mockResolvedValue(null)
    await syncCorpWalletPayments().catch(() => undefined)
    expect(JSON.stringify(mockPrisma.character.findFirst.mock.calls[0][0].where)).not.toContain('name')
  })

  it('explains a missing-scope ESI error', async () => {
    mockJournal.mockRejectedValue(new Error('Request failed with status code 403 Forbidden'))
    await expect(syncCorpWalletPayments()).rejects.toThrow(/Fleet Citizen 07 lacks the scopes/)
  })

  it('credits a donation to the account code in the note, with history in the same transaction', async () => {
    mockJournal.mockResolvedValue([donation({ reason: 'sub EVE-DQHX97' })])
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'brutus' })

    const result = await syncCorpWalletPayments()

    expect(result).toMatchObject({ newPaymentsCount: 1, needsReviewCount: 0, manager: 'Fleet Citizen 07', corpId: 98826336 })
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ userId: 'brutus', needsReview: false, status: 'pending' })
    expect(tx.user.update).toHaveBeenCalledWith({ where: { id: 'brutus' }, data: { iskBalance: { increment: 100_000_000 } } })
    expect(tx.iskHistory.create).toHaveBeenCalled()
    expect(mockPrisma.notification.createMany).not.toHaveBeenCalled()
  })

  it('falls back to the registered payer character', async () => {
    mockJournal.mockResolvedValue([donation()])
    mockPrisma.character.findUnique.mockResolvedValue({ userId: 'brutus', name: 'Brutus Kobalt' })
    await syncCorpWalletPayments()
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ userId: 'brutus', payerCharacterName: 'Brutus Kobalt', needsReview: false })
  })

  it('parks an unmatched donation on master, flags it for review and tells the masters', async () => {
    mockJournal.mockResolvedValue([donation()])

    const result = await syncCorpWalletPayments()

    expect(result.needsReviewCount).toBe(1)
    expect(tx.payment.create.mock.calls[0][0].data).toMatchObject({ userId: 'master-1', needsReview: true })
    expect(mockPrisma.notification.createMany.mock.calls[0][0].data[0]).toMatchObject({
      userId: 'master-1',
      type: 'payment',
      link: '/dashboard/admin/finance/payments',
    })
  })

  it('refuses to park a donation when there is no master account', async () => {
    mockJournal.mockResolvedValue([donation()])
    mockPrisma.user.findFirst.mockResolvedValue(null)
    await expect(syncCorpWalletPayments()).rejects.toThrow(/no master account/)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })

  it('skips non-donations, non-positive amounts and already-imported entries', async () => {
    mockJournal.mockResolvedValue([
      donation({ id: 1, ref_type: 'bounty_prizes' }),
      donation({ id: 2, amount: -5 }),
      donation({ id: 3 }),
    ])
    mockPrisma.payment.findUnique.mockResolvedValue({ id: 'already' })
    const result = await syncCorpWalletPayments()
    expect(result.newPaymentsCount).toBe(0)
    expect(mockPrisma.$transaction).not.toHaveBeenCalled()
  })
})
