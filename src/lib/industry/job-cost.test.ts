import { computeLocalJobCost, computeEiv } from '@/lib/industry/job-cost'

const mockCacheFindUnique = jest.fn()
const mockCacheUpsert = jest.fn()
const mockEsiClientGet = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    sdeCache: {
      findUnique: (...args: unknown[]) => mockCacheFindUnique(...args),
      upsert: (...args: unknown[]) => mockCacheUpsert(...args),
    },
  },
}))

jest.mock('@/lib/esi-client', () => ({
  esiClient: { get: (...args: unknown[]) => mockEsiClientGet(...args) },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}))

function costIndexEntry(solarSystemId: number, indices: { activity: string; cost_index: number }[]) {
  return { solar_system_id: solarSystemId, cost_indices: indices }
}

describe('getCostIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCacheFindUnique.mockResolvedValue(null)
    mockCacheUpsert.mockResolvedValue({})
  })

  it('picks the manufacturing index, not the reaction index, for the same system', async () => {
    const { getCostIndex } = await import('./job-cost')

    mockEsiClientGet.mockResolvedValue({
      data: [
        costIndexEntry(30000142, [
          { activity: 'manufacturing', cost_index: 0.02 },
          { activity: 'reaction', cost_index: 0.05 },
        ]),
      ],
    })

    const manufacturing = await getCostIndex(30000142, 'manufacturing')
    expect(manufacturing).toBe(0.02)
  })

  it('picks the reaction index, not the manufacturing index, for the same system', async () => {
    const { getCostIndex } = await import('./job-cost')

    mockEsiClientGet.mockResolvedValue({
      data: [
        costIndexEntry(30000142, [
          { activity: 'manufacturing', cost_index: 0.02 },
          { activity: 'reaction', cost_index: 0.05 },
        ]),
      ],
    })

    const reaction = await getCostIndex(30000142, 'reaction')
    expect(reaction).toBe(0.05)
  })

  it('serves both activities from a single cached document without cross-serving', async () => {
    const { getCostIndex } = await import('./job-cost')

    mockCacheFindUnique.mockResolvedValue({
      value: {
        indices: { manufacturing: { 30000142: 0.02 }, reaction: { 30000142: 0.05 } },
        updatedAt: Date.now(),
      },
    })

    expect(await getCostIndex(30000142, 'manufacturing')).toBe(0.02)
    expect(await getCostIndex(30000142, 'reaction')).toBe(0.05)
    // Cache hit within TTL — never re-fetches.
    expect(mockEsiClientGet).not.toHaveBeenCalled()
  })

  it('returns null (never 0) when the system has no index for the requested activity', async () => {
    const { getCostIndex } = await import('./job-cost')

    mockEsiClientGet.mockResolvedValue({
      data: [costIndexEntry(30000142, [{ activity: 'manufacturing', cost_index: 0.02 }])],
    })

    expect(await getCostIndex(30000142, 'reaction')).toBeNull()
  })

  it('returns null on total ESI failure with no usable cache (never defaults to 0)', async () => {
    const { getCostIndex } = await import('./job-cost')

    mockEsiClientGet.mockRejectedValue(new Error('esi down'))

    expect(await getCostIndex(30000142, 'manufacturing')).toBeNull()
  })
})

describe('getManufacturingCostIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCacheFindUnique.mockResolvedValue(null)
    mockCacheUpsert.mockResolvedValue({})
  })

  it('delegates to getCostIndex with the manufacturing activity', async () => {
    const { getManufacturingCostIndex } = await import('./job-cost')

    mockEsiClientGet.mockResolvedValue({
      data: [
        costIndexEntry(30000142, [
          { activity: 'manufacturing', cost_index: 0.03 },
          { activity: 'reaction', cost_index: 0.09 },
        ]),
      ],
    })

    expect(await getManufacturingCostIndex(30000142)).toBe(0.03)
  })
})

describe('computeEiv', () => {
  it('sums base quantity (ME0) × runs × adjusted price', () => {
    const materials = [
      { typeId: 34, baseQuantity: 100 }, // Tritanium
      { typeId: 35, baseQuantity: 50 }, // Pyerite
    ]
    const adjusted = { 34: 5, 35: 10 }
    const { eiv, missingPrices } = computeEiv(materials, 1, adjusted)
    expect(eiv).toBe(100 * 5 + 50 * 10)
    expect(missingPrices).toEqual([])
  })

  it('scales linearly with runs', () => {
    const materials = [{ typeId: 34, baseQuantity: 100 }]
    const adjusted = { 34: 5 }
    expect(computeEiv(materials, 1, adjusted).eiv).toBe(500)
    expect(computeEiv(materials, 10, adjusted).eiv).toBe(5000)
  })

  it('surfaces materials with no adjusted price instead of pricing them at 0', () => {
    const materials = [
      { typeId: 34, baseQuantity: 100 },
      { typeId: 999, baseQuantity: 10 },
    ]
    const adjusted = { 34: 5 }
    const { eiv, missingPrices } = computeEiv(materials, 1, adjusted)
    expect(eiv).toBe(500) // only the priced material counted
    expect(missingPrices).toEqual([999])
  })

  it('clamps runs to at least 1', () => {
    const materials = [{ typeId: 34, baseQuantity: 100 }]
    const adjusted = { 34: 5 }
    expect(computeEiv(materials, 0, adjusted).eiv).toBe(500)
    expect(computeEiv(materials, -3, adjusted).eiv).toBe(500)
  })
})

describe('computeLocalJobCost', () => {
  it('SCC surcharge is exactly 4% of EIV', () => {
    const result = computeLocalJobCost({ eiv: 380211, costIndex: 0, facilityTaxPct: 0 })
    expect(result.sccSurcharge).toBeCloseTo(380211 * 0.04, 5)
  })

  it('matches the validated Rifter/Jita EVE Ref example ratios', () => {
    // Validated live 2026-07-16: EIV 380211, scc 15208 (=4%), facility 951 (=0.25%), total_job_cost 86536.
    // System cost index backed out from those numbers: (86536 - 15208 - 951) / 380211.
    const eiv = 380211
    const facilityTaxPct = 0.25
    const costIndex = (86536 - 380211 * 0.04 - 951) / eiv
    const result = computeLocalJobCost({ eiv, costIndex, facilityTaxPct })
    expect(result.facilityTax).toBeCloseTo(951, 0)
    expect(result.sccSurcharge).toBeCloseTo(15208, 0)
    expect(result.total).toBeCloseTo(86536, 0)
  })

  it('sums indexCost + sccSurcharge + facilityTax into total', () => {
    const result = computeLocalJobCost({ eiv: 1000, costIndex: 0.05, facilityTaxPct: 1 })
    expect(result.indexCost).toBe(50)
    expect(result.sccSurcharge).toBe(40)
    expect(result.facilityTax).toBe(10)
    expect(result.total).toBe(100)
  })

  it('zero facility tax and zero cost index still yields the SCC surcharge only', () => {
    const result = computeLocalJobCost({ eiv: 1000, costIndex: 0, facilityTaxPct: 0 })
    expect(result.indexCost).toBe(0)
    expect(result.facilityTax).toBe(0)
    expect(result.sccSurcharge).toBe(40)
    expect(result.total).toBe(40)
  })

  it('clamps negative inputs to 0', () => {
    const result = computeLocalJobCost({ eiv: -100, costIndex: -0.5, facilityTaxPct: -5 })
    expect(result.total).toBe(0)
  })
})
