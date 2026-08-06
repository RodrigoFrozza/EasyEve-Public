import {
  appendEscalationDrop,
  markEscalationSold,
  deleteEscalationDrop,
  recalcEscalationTotals,
  dedupeEscalationDrops,
} from './ratting-manual-entries'
import {
  getEscalationsForFaction,
  getEscalationsForActivity,
  RATTING_ESCALATIONS,
} from '@/lib/constants/ratting-escalations'
import { getActivityFinancialMetrics } from './activity-metrics'

describe('ratting escalation drops', () => {
  it('appendEscalationDrop adds drop with dropped status and escalation log', () => {
    const result = appendEscalationDrop({}, {
      siteName: 'The Maze',
      dedRating: '10/10',
      faction: 'Guristas',
      charName: 'Pilot One',
    })

    expect(result.escalationDrops).toHaveLength(1)
    expect(result.escalationDrops![0]).toMatchObject({
      siteName: 'The Maze',
      dedRating: '10/10',
      faction: 'Guristas',
      charName: 'Pilot One',
      status: 'dropped',
      soldValue: null,
    })
    expect(result.estimatedEscalationValue).toBe(0)
    expect(result.logs).toHaveLength(1)
    expect(result.logs![0]).toMatchObject({
      type: 'escalation',
      amount: 0,
      charName: 'Pilot One',
      escalationStatus: 'dropped',
    })
  })

  it('markEscalationSold updates drop, log amount, and totals', () => {
    const withDrop = appendEscalationDrop({}, {
      siteName: 'The Maze',
      dedRating: '10/10',
      faction: 'Guristas',
    })
    const refId = withDrop.escalationDrops![0].refId
    const soldAt = '2026-06-19T12:00:00.000Z'

    const result = markEscalationSold(withDrop, refId, 450_000_000, soldAt)

    expect(result).not.toBeNull()
    expect(result!.escalationDrops![0]).toMatchObject({
      status: 'sold',
      soldValue: 450_000_000,
      soldAt,
    })
    expect(result!.estimatedEscalationValue).toBe(450_000_000)
    expect(result!.logs![0]).toMatchObject({
      type: 'escalation',
      amount: 450_000_000,
      date: soldAt,
      escalationStatus: 'sold',
    })
  })

  it('deleteEscalationDrop removes drop and log', () => {
    const withDrop = appendEscalationDrop({}, { siteName: 'Custom Site' })
    const refId = withDrop.escalationDrops![0].refId

    const result = deleteEscalationDrop(withDrop, refId)

    expect(result).not.toBeNull()
    expect(result!.escalationDrops).toHaveLength(0)
    expect(result!.logs).toHaveLength(0)
    expect(result!.estimatedEscalationValue).toBe(0)
  })

  it('dedupeEscalationDrops keeps first entry per refId', () => {
    const deduped = dedupeEscalationDrops([
      { refId: 'a', siteName: 'A', droppedAt: '2026-01-01', status: 'sold', soldValue: 100 },
      { refId: 'a', siteName: 'A duplicate', droppedAt: '2026-01-02', status: 'sold', soldValue: 200 },
      { refId: 'b', siteName: 'B', droppedAt: '2026-01-01', status: 'dropped' },
    ])

    expect(deduped).toHaveLength(2)
    expect(deduped[0].soldValue).toBe(100)
  })

  it('recalcEscalationTotals sums only sold drops', () => {
    const totals = recalcEscalationTotals([
      { refId: 'a', siteName: 'A', droppedAt: '2026-01-01', status: 'dropped' },
      { refId: 'b', siteName: 'B', droppedAt: '2026-01-01', status: 'sold', soldValue: 100 },
      { refId: 'c', siteName: 'C', droppedAt: '2026-01-01', status: 'sold', soldValue: 250 },
    ])

    expect(totals.estimatedEscalationValue).toBe(350)
  })
})

describe('ratting escalation catalog', () => {
  it('getEscalationsForFaction filters by faction', () => {
    const guristas = getEscalationsForFaction('Guristas')
    expect(guristas.length).toBeGreaterThan(0)
    expect(guristas.every((e) => e.faction === 'Guristas')).toBe(true)
    expect(guristas.some((e) => e.siteName === 'The Maze')).toBe(true)
  })

  it('getEscalationsForFaction returns all when faction is empty', () => {
    expect(getEscalationsForFaction()).toEqual(RATTING_ESCALATIONS)
    expect(getEscalationsForFaction('')).toEqual(RATTING_ESCALATIONS)
  })

  it('getEscalationsForFaction returns all for unknown or non-ratting factions', () => {
    expect(getEscalationsForFaction('unknown')).toEqual(RATTING_ESCALATIONS)
    expect(getEscalationsForFaction('Sleepers')).toEqual(RATTING_ESCALATIONS)
    expect(getEscalationsForFaction('Triglavian')).toEqual(RATTING_ESCALATIONS)
  })

  it('getEscalationsForFaction matches faction name prefixes', () => {
    const guristas = getEscalationsForFaction('Guristas Pirates')
    expect(guristas.length).toBeGreaterThan(0)
    expect(guristas.every((e) => e.faction === 'Guristas')).toBe(true)
  })

  it('getEscalationsForActivity uses session npcFaction', () => {
    const filtered = getEscalationsForActivity({ data: { npcFaction: 'Angel Cartel' } })
    expect(filtered.every((e) => e.faction === 'Angel Cartel')).toBe(true)
  })
})

describe('getActivityFinancialMetrics escalations', () => {
  it('includes estimatedEscalationValue in ratting gross and net', () => {
    const metrics = getActivityFinancialMetrics({
      type: 'ratting',
      data: {
        automatedBounties: 1_000_000,
        estimatedLootValue: 100_000,
        estimatedEscalationValue: 450_000_000,
        automatedTaxes: 50_000,
      },
    })

    expect(metrics.escalations).toBe(450_000_000)
    expect(metrics.gross).toBe(451_100_000)
    expect(metrics.net).toBe(451_050_000)
  })
})
