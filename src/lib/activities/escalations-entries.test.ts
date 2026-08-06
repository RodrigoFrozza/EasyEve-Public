import {
  appendEscalation,
  dedupeEscalations,
  markEscalationExpired,
  recalcEscalationTotals,
  setEscalationLoot,
  syncExpiredEscalations,
  type EscalationsActivityData,
} from './escalations-entries'

describe('escalations-entries', () => {
  const base: EscalationsActivityData = { logs: [], escalations: [] }

  it('appendEscalation logs buy and recalculates cost', () => {
    const updated = appendEscalation(base, {
      name: 'Angel Cartel Naval Shipyard',
      pricePaid: 50_000_000,
      purchasedFrom: 'SellerOne',
    })

    expect(updated.escalations).toHaveLength(1)
    expect(updated.estimatedEscalationCostValue).toBe(50_000_000)
    expect(updated.logs?.[0]?.type).toBe('escalation-buy')
    expect(updated.logs?.[0]?.amount).toBe(-50_000_000)
  })

  it('setEscalationLoot completes entry and recalculates loot total', () => {
    const withBuy = appendEscalation(base, {
      name: 'Test Site',
      pricePaid: 10_000_000,
    })
    const refId = withBuy.escalations![0].refId

    const updated = setEscalationLoot(withBuy, refId, {
      lootMode: 'manual',
      lootValue: 120_000_000,
    })

    expect(updated?.escalations?.[0].status).toBe('completed')
    expect(updated?.estimatedEscalationLootValue).toBe(120_000_000)
    expect(updated?.logs?.some((l) => l.type === 'escalation-loot')).toBe(true)
  })

  it('dedupeEscalations keeps first refId only', () => {
    const duped = dedupeEscalations([
      { refId: 'a', name: 'One', acquiredAt: '2024-01-01', status: 'active' },
      { refId: 'a', name: 'Dup', acquiredAt: '2024-01-02', status: 'active' },
      { refId: 'b', name: 'Two', acquiredAt: '2024-01-03', status: 'active' },
    ])
    expect(duped).toHaveLength(2)
  })

  it('recalcEscalationTotals sums loot and purchase cost', () => {
    const totals = recalcEscalationTotals([
      { refId: '1', name: 'A', acquiredAt: '2024-01-01', status: 'completed', pricePaid: 5_000_000, lootValue: 80_000_000 },
      { refId: '2', name: 'B', acquiredAt: '2024-01-02', status: 'active', pricePaid: 2_000_000 },
    ])
    expect(totals.estimatedEscalationCostValue).toBe(7_000_000)
    expect(totals.estimatedEscalationLootValue).toBe(80_000_000)
  })

  it('markEscalationExpired updates status without deleting', () => {
    const data: EscalationsActivityData = {
      escalations: [
        { refId: 'x', name: 'Site', acquiredAt: '2024-01-01', status: 'active' },
      ],
    }
    const updated = markEscalationExpired(data, 'x')
    expect(updated?.escalations?.[0].status).toBe('expired')
  })

  it('syncExpiredEscalations marks past-due active entries', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    const data: EscalationsActivityData = {
      escalations: [
        {
          refId: 'x',
          name: 'Site',
          acquiredAt: '2024-01-01',
          expiresAt: past,
          status: 'active',
        },
      ],
    }
    const updated = syncExpiredEscalations(data)
    expect(updated.escalations?.[0].status).toBe('expired')
  })
})
