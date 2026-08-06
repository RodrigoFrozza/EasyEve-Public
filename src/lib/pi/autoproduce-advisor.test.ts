import {
  evaluateAutoproduce,
  getSchematicByOutput,
  sumAutoproduceSavingsPerHour,
} from './autoproduce-advisor'
import type { PiPriceMap } from './pi-pricing'
import type { MarketDepth } from '@/lib/market-prices'
import type { PiColonyAnalysis } from '@/lib/pi/types'

// Superconductors (9838) = 40× (2389) + 40× (3645) → output qty 5. So one unit
// needs 8 of each input.
const OUTPUT = 9838
const IN_A = 2389
const IN_B = 3645

const deep: MarketDepth = { sell: [{ price: 1, volume: 1e9, locationId: 0 }], buy: [], updatedAt: 0 }
const empty: MarketDepth = { sell: [], buy: [], updatedAt: 0 }

const prices: PiPriceMap = {
  [OUTPUT]: { buy: 200, sell: 0 },
  [IN_A]: { buy: 10, sell: 0 },
  [IN_B]: { buy: 10, sell: 0 },
}

describe('evaluateAutoproduce', () => {
  it('uses the real SDE schematic (one unit needs 8 of each input)', () => {
    const s = getSchematicByOutput(OUTPUT)
    expect(s?.output.qty).toBe(5)
    expect(s?.inputs).toEqual(
      expect.arrayContaining([
        { typeId: IN_A, qty: 40 },
        { typeId: IN_B, qty: 40 },
      ])
    )
  })

  it('recommends self-producing when it is cheaper and stock is fine', () => {
    const depth = { [OUTPUT]: deep, [IN_A]: deep, [IN_B]: deep }
    const d = evaluateAutoproduce(OUTPUT, 100, prices, depth)
    // 8×10 + 8×10 = 160 to self-produce vs 200 to buy ready.
    expect(d?.autoproduceUnitCost).toBe(160)
    expect(d?.savingsPerUnit).toBe(40)
    expect(d?.recommendation).toBe('autoproduce')
  })

  it('forces buying ready when the inputs are out of stock', () => {
    const depth = { [OUTPUT]: deep, [IN_A]: empty, [IN_B]: deep }
    expect(evaluateAutoproduce(OUTPUT, 100, prices, depth)?.recommendation).toBe('buy_forced')
  })

  it('forces self-production when the ready product is out of stock', () => {
    const depth = { [OUTPUT]: empty, [IN_A]: deep, [IN_B]: deep }
    expect(evaluateAutoproduce(OUTPUT, 100, prices, depth)?.recommendation).toBe(
      'autoproduce_forced'
    )
  })

  it('recommends buying ready when self-producing is more expensive', () => {
    const pricey: PiPriceMap = {
      [OUTPUT]: { buy: 100, sell: 0 },
      [IN_A]: { buy: 10, sell: 0 },
      [IN_B]: { buy: 10, sell: 0 }, // 160 to self-produce vs 100 to buy
    }
    const depth = { [OUTPUT]: deep, [IN_A]: deep, [IN_B]: deep }
    expect(evaluateAutoproduce(OUTPUT, 100, pricey, depth)?.recommendation).toBe('buy')
  })

  it('returns null for a commodity with no schematic (raw P0)', () => {
    expect(evaluateAutoproduce(2073, 100, prices, {})).toBeNull()
  })

  it('sums per-hour savings across colonies for autoproduce-recommended imports', () => {
    const depth = { [OUTPUT]: deep, [IN_A]: deep, [IN_B]: deep }
    const colony = {
      balances: { potential: [{ typeId: OUTPUT, importNeededPerHour: 10 }] },
    } as unknown as PiColonyAnalysis
    // 40 ISK/unit saved × 10 units/h = 400 ISK/h.
    expect(sumAutoproduceSavingsPerHour([colony], prices, depth)).toBe(400)
  })
})
