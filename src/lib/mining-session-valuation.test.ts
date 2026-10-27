import {
  resolvePriceSide,
  resolveRawUnitPrice,
  resolveRefinedUnitPrice,
  resolveColumnUnitPrice,
  calculateSessionValuation,
  inferMiningCategoryFromBreakdown,
  buildPriceRowIndexes,
  buildReprocessingProductPrices,
} from './mining-session-valuation'

describe('resolvePriceSide', () => {
  it('returns buy price for buy mode', () => {
    expect(resolvePriceSide(10, 8, 'buy')).toBe(10)
  })

  it('falls back to sell when buy is zero for buy mode', () => {
    expect(resolvePriceSide(0, 8, 'buy')).toBe(8)
  })

  it('returns sell price for sell mode', () => {
    expect(resolvePriceSide(10, 8, 'sell')).toBe(8)
  })

  it('returns average for split when both sides exist', () => {
    expect(resolvePriceSide(10, 8, 'split')).toBe(9)
  })

  it('falls back to single side for split when one is zero', () => {
    expect(resolvePriceSide(10, 0, 'split')).toBe(10)
    expect(resolvePriceSide(0, 8, 'split')).toBe(8)
  })
})

describe('resolveRawUnitPrice', () => {
  const entry = {
    buy: 10,
    sell: 8,
    compressedBuy: 1000,
    compressedSell: 800,
  }

  it('uses raw buy for buy mode', () => {
    expect(resolveRawUnitPrice(entry, 'buy', false)).toBe(10)
  })

  it('uses raw sell for sell mode', () => {
    expect(resolveRawUnitPrice(entry, 'sell', false)).toBe(8)
  })

  it('uses split average for split mode', () => {
    expect(resolveRawUnitPrice(entry, 'split', false)).toBe(9)
  })

  it('falls back to compressed buy scaled by 100 for ore', () => {
    expect(
      resolveRawUnitPrice(
        { buy: 0, sell: 0, compressedBuy: 1000, compressedSell: 0 },
        'buy',
        false
      )
    ).toBe(10)
  })

  it('uses compressed buy 1:1 for ice', () => {
    expect(
      resolveRawUnitPrice(
        { buy: 0, sell: 0, compressedBuy: 250000, compressedSell: 0 },
        'buy',
        true
      )
    ).toBe(250000)
  })
})

describe('resolveRefinedUnitPrice', () => {
  it('applies efficiency to buy price', () => {
    expect(resolveRefinedUnitPrice(100, 80, 'buy', 90)).toBe(90)
  })

  it('applies efficiency to sell price', () => {
    expect(resolveRefinedUnitPrice(100, 80, 'sell', 90)).toBe(72)
  })

  it('uses split base for split mode', () => {
    expect(resolveRefinedUnitPrice(100, 80, 'split', 100)).toBe(90)
  })

  it('returns 0 when no prices', () => {
    expect(resolveRefinedUnitPrice(0, 0, 'buy', 90)).toBe(0)
  })
})

describe('resolveColumnUnitPrice', () => {
  it('prefers explicit split field when positive', () => {
    expect(
      resolveColumnUnitPrice({ buy: 10, sell: 8, split: 9, price: 10 }, 'split')
    ).toBe(9)
  })

  it('falls back to buy/sell average for split when split is zero', () => {
    expect(resolveColumnUnitPrice({ buy: 10, sell: 8, split: 0 }, 'split')).toBe(9)
  })

  it('falls back to sell for buy mode when buy is zero', () => {
    expect(resolveColumnUnitPrice({ buy: 0, sell: 8 }, 'buy')).toBe(8)
  })
})

describe('calculateSessionValuation', () => {
  const oreBreakdown = {
    '1230': {
      name: 'Veldspar',
      quantity: 1000,
      buy: 10,
      sell: 8,
      compressedBuy: 0,
      compressedSell: 0,
    },
    '9999': {
      name: 'Unknown Ore',
      quantity: 500,
      buy: 5,
      sell: 4,
      compressedBuy: 0,
      compressedSell: 0,
    },
  }

  const priceRowsById = {
    1230: {
      id: 1230,
      name: 'Veldspar',
      reprocessingProducts: [
        { materialId: 34, quantity: 415, buy: 12, sell: 10, split: 11 },
      ],
    },
  }

  it('calculates raw and refined totals with efficiency', () => {
    const result = calculateSessionValuation(oreBreakdown, priceRowsById, {
      priceSide: 'buy',
      efficiencyPct: 90,
      isIceMiningCategory: false,
      hours: 2,
    })

    expect(result.rawTotal).toBe(1000 * 10 + 500 * 5)
    // Veldspar refined: 415 trit @ 12 buy / 100 batch * 90% * 1000 qty
    expect(result.refinedTotal).toBe((415 * 12) / 100 * 0.9 * 1000)
    expect(result.rawIskPerHour).toBe(result.rawTotal / 2)
    expect(result.refinedIskPerHour).toBe(result.refinedTotal / 2)
    expect(result.byOre).toHaveLength(2)
    expect(result.byOre[0].name).toBe('Veldspar')
  })

  it('calculates delta pct when refined exceeds raw', () => {
    const highRefinedBreakdown = {
      '1230': {
        name: 'Veldspar',
        quantity: 1000,
        buy: 5,
        sell: 4,
        compressedBuy: 0,
        compressedSell: 0,
      },
    }
    const highRefinedPrices = {
      1230: {
        id: 1230,
        name: 'Veldspar',
        reprocessingProducts: [
          { materialId: 34, quantity: 415, buy: 15, sell: 12, split: 13.5 },
        ],
      },
    }

    const result = calculateSessionValuation(highRefinedBreakdown, highRefinedPrices, {
      priceSide: 'buy',
      efficiencyPct: 100,
      isIceMiningCategory: false,
      hours: 1,
    })

    expect(result.deltaPct).toBeGreaterThan(0)
    expect(result.byOre[0].deltaPct).toBeGreaterThan(0)
  })

  it('handles ore without refined yields as zero refined value', () => {
    const result = calculateSessionValuation(oreBreakdown, priceRowsById, {
      priceSide: 'buy',
      efficiencyPct: 90,
      isIceMiningCategory: false,
      hours: 1,
    })

    const unknown = result.byOre.find((o) => o.typeId === '9999')
    expect(unknown?.rawIsk).toBe(2500)
    expect(unknown?.refinedIsk).toBe(0)
  })

  it('resolves refined price by base ore name when typeId differs', () => {
    const iceBreakdown = {
      '17977': {
        name: 'Glacial Mass IV-Grade',
        quantity: 100,
        buy: 200000,
        sell: 180000,
        compressedBuy: 0,
        compressedSell: 0,
      },
    }
    const products = buildReprocessingProductPrices('Glacial Mass IV-Grade', {
      17889: { buy: 1000, sell: 900 },
      16272: { buy: 100, sell: 80 },
      16273: { buy: 200, sell: 180 },
    })
    const { byId, byBaseName } = buildPriceRowIndexes([
      {
        id: 17886,
        name: 'Glacial Mass',
        reprocessingProducts: products,
      },
    ])

    const result = calculateSessionValuation(
      iceBreakdown,
      byId,
      {
        priceSide: 'buy',
        efficiencyPct: 90,
        isIceMiningCategory: true,
        hours: 1,
        mineralPrices: {
          17889: { buy: 1000, sell: 900 },
          16272: { buy: 100, sell: 80 },
          16273: { buy: 200, sell: 180 },
        },
      },
      byBaseName
    )

    expect(result.refinedTotal).toBeGreaterThan(0)
  })

  it('computes refined from reprocessing products per mined item', () => {
    const breakdown = {
      '16266': {
        name: 'Glare Crust',
        quantity: 10,
        buy: 200000,
        sell: 180000,
        compressedBuy: 0,
        compressedSell: 0,
      },
    }
    const products = buildReprocessingProductPrices('Glare Crust', {
      16272: { buy: 100, sell: 90 },
      16273: { buy: 200, sell: 180 },
      16275: { buy: 500, sell: 450 },
    })
    const result = calculateSessionValuation(
      breakdown,
      {
        16266: {
          id: 16266,
          name: 'Glare Crust',
          reprocessingProducts: products,
        },
      },
      {
        priceSide: 'buy',
        efficiencyPct: 100,
        isIceMiningCategory: true,
        hours: 1,
      }
    )

    // Glare Crust: 250 HW + 500 LO + 75 Strontium per unit (batch=1)
    const expectedUnit = 250 * 100 + 500 * 200 + 75 * 500
    expect(result.refinedTotal).toBe(10 * expectedUnit)
  })
})

describe('inferMiningCategoryFromBreakdown', () => {
  it('infers Ice from ore names when declared type is Ore', () => {
    expect(
      inferMiningCategoryFromBreakdown('Ore', {
        '16266': { name: 'Glare Crust' },
      })
    ).toBe('Ice')
  })

  it('respects explicit Ice category', () => {
    expect(inferMiningCategoryFromBreakdown('Ice', {})).toBe('Ice')
  })
})
