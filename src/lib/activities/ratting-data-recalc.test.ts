import {
  applyRattingLootPatch,
  hasLegacyRattingLootStringShape,
  recalcRattingWalletTotalsFromLogs,
} from './ratting-data-recalc'
import type { RattingLogEntry } from './ratting-manual-entries'

describe('ratting-data-recalc', () => {
  it('detects legacy mtu loot string shape', () => {
    expect(
      hasLegacyRattingLootStringShape({
        mtuContents: [{ loot: 'Tritanium\t1000' }],
      })
    ).toBe(true)
    expect(
      hasLegacyRattingLootStringShape({
        mtuContents: [[{ name: 'Tritanium', quantity: 1000, value: 5000 }]],
      })
    ).toBe(false)
  })

  it('recalculates wallet totals without counting taxes in participant earnings', () => {
    const logs: RattingLogEntry[] = [
      { refId: '1', type: 'bounty', amount: 1000, date: '2025-01-01T00:00:00Z', charId: 42 },
      { refId: '2', type: 'ess', amount: 200, date: '2025-01-01T00:05:00Z', charId: 42 },
      { refId: '3', type: 'tax', amount: -50, date: '2025-01-01T00:06:00Z', charId: 42 },
      { refId: '4', type: 'mtu', amount: 300, date: '2025-01-01T00:10:00Z', charId: 42 },
    ]

    const totals = recalcRattingWalletTotalsFromLogs(logs, 100)
    expect(totals.automatedBounties).toBe(1000)
    expect(totals.automatedEss).toBe(200)
    expect(totals.automatedTaxes).toBe(50)
    expect(totals.grossBounties).toBe(1300)
    expect(totals.participantEarnings[42]).toBe(1200)
    expect(totals.estimatedLootValue).toBe(300)
  })

  it('applyRattingLootPatch preserves modern mtu loot totals from logs', async () => {
    const updated = await applyRattingLootPatch(
      {
        logs: [
          {
            refId: 'mtu-1',
            type: 'mtu',
            amount: 5000,
            date: '2025-01-01T00:10:00Z',
            charId: 1,
          },
        ],
        estimatedLootValue: 5000,
        estimatedSalvageValue: 0,
        automatedBounties: 1000,
        automatedEss: 0,
        automatedTaxes: 0,
        additionalBounties: 0,
      },
      {
        mtuContents: [[{ name: 'Tritanium', quantity: 1000, value: 5000 }]],
      }
    )

    expect(updated.estimatedLootValue).toBe(5000)
    expect(updated.estimatedLootValue).not.toBe(0)
    expect(updated.lastDataAt).toBeDefined()
  })
})
