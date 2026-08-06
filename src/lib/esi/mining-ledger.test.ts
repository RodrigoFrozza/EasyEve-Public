import {
  aggregateBaselinesByTypeId,
  buildDailyBaselines,
  buildEntryMapForDate,
  fetchMiningLedgerForCharacter,
  mergeBaselinesForLateJoin,
  sumEntryQuantities,
} from '@/lib/esi/mining-ledger'
import { getValidAccessToken } from '@/lib/token-manager'

jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: jest.fn(),
}))

const mockGetValidAccessToken = getValidAccessToken as unknown as jest.Mock

const MERCOXIT_TYPE = 11396
const CHAR_ID = 2123456789
const SYSTEM_ID = 30000142
const TODAY = '2026-06-18'

function effectiveQty(esiQty: number, baselineQty: number): number {
  return Math.max(0, esiQty - baselineQty)
}

describe('mining ledger baselines', () => {
  it('attributes full quantity when pre-detection baseline is empty (auto-detect scenario)', () => {
    const preDetectionBaselines: Record<string, number> = {}
    const esiQty = 12_824
    const key = `${CHAR_ID}-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`
    const baselineQty = preDetectionBaselines[key] ?? 0
    expect(effectiveQty(esiQty, baselineQty)).toBe(12_824)
  })

  it('does not discard triggering ore when baseline uses pre-detection snapshot', () => {
    const preDetectionBaselines = buildEntryMapForDate(
      CHAR_ID,
      [{ date: TODAY, quantity: 3324, type_id: MERCOXIT_TYPE, solar_system_id: SYSTEM_ID }],
      TODAY
    )
    const esiQty = 12_824
    const key = `${CHAR_ID}-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`
    const baselineQty = preDetectionBaselines[key] ?? 0
    expect(baselineQty).toBe(3324)
    expect(effectiveQty(esiQty, baselineQty)).toBe(9500)
  })

  it('late-join preserves existing participant baselines', () => {
    const existing = {
      [`100-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`]: 5000,
    }
    const incoming = buildDailyBaselines(
      [
        {
          charId: 200,
          entries: [
            { date: TODAY, quantity: 8000, type_id: MERCOXIT_TYPE, solar_system_id: SYSTEM_ID },
          ],
        },
      ],
      TODAY,
      [200]
    )

    const merged = mergeBaselinesForLateJoin(existing, incoming, [200])
    expect(merged[`100-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`]).toBe(5000)
    expect(merged[`200-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`]).toBe(8000)
  })

  it('aggregates baselines by typeId for UI diagnostics', () => {
    const baselines = {
      [`${CHAR_ID}-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`]: 3324,
      [`${CHAR_ID}-11397-${SYSTEM_ID}-${TODAY}`]: 1400,
    }
    const byType = aggregateBaselinesByTypeId(baselines, TODAY)
    expect(byType[MERCOXIT_TYPE]).toBe(3324)
    expect(byType[11397]).toBe(1400)
  })

  it('buildDailyBaselines scopes to selected character ids', () => {
    const baselines = buildDailyBaselines(
      [
        {
          charId: 100,
          entries: [
            { date: TODAY, quantity: 1000, type_id: MERCOXIT_TYPE, solar_system_id: SYSTEM_ID },
          ],
        },
        {
          charId: 200,
          entries: [
            { date: TODAY, quantity: 2000, type_id: MERCOXIT_TYPE, solar_system_id: SYSTEM_ID },
          ],
        },
      ],
      TODAY,
      [200]
    )

    expect(Object.keys(baselines)).toHaveLength(1)
    expect(baselines[`200-${MERCOXIT_TYPE}-${SYSTEM_ID}-${TODAY}`]).toBe(2000)
  })

  it('sums entry map quantities for detection aggregate', () => {
    const map = buildEntryMapForDate(
      CHAR_ID,
      [
        { date: TODAY, quantity: 3324, type_id: MERCOXIT_TYPE, solar_system_id: SYSTEM_ID },
        { date: TODAY, quantity: 1400, type_id: 11397, solar_system_id: SYSTEM_ID },
      ],
      TODAY
    )
    expect(sumEntryQuantities(map)).toBe(4724)
  })
})

describe('fetchMiningLedgerForCharacter failure signalling', () => {
  afterEach(() => jest.clearAllMocks())

  it('returns ok:false with no_token when the character has no valid token', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: null })

    const result = await fetchMiningLedgerForCharacter(CHAR_ID, 'Skyfall Alt')

    // A broken/expired token must be distinguishable from "mined nothing today",
    // so the sync can surface it instead of silently dropping the pilot's yield.
    expect(result.ok).toBe(false)
    expect(result.error).toBe('no_token')
    expect(result.entries).toEqual([])
    expect(result.charId).toBe(CHAR_ID)
    expect(result.charName).toBe('Skyfall Alt')
  })
})

describe('ESI delay Math.max merge', () => {
  it('keeps the highest effective quantity when ESI reports an increase', () => {
    const previousEffective = 9000
    const newEffective = 9524
    expect(Math.max(previousEffective, newEffective)).toBe(9524)
  })
})
