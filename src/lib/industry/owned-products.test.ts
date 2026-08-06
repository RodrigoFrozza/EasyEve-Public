const mockBlueprintFindMany = jest.fn()
const mockProductFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    characterBlueprint: {
      findMany: (...args: unknown[]) => mockBlueprintFindMany(...args),
    },
    blueprintProduct: {
      findMany: (...args: unknown[]) => mockProductFindMany(...args),
    },
  },
}))

describe('getOwnedBlueprintProducts', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns empty and skips the product query when no blueprints are owned', async () => {
    mockBlueprintFindMany.mockResolvedValue([])
    const { getOwnedBlueprintProducts } = await import('./owned-products')
    expect(await getOwnedBlueprintProducts('u1')).toEqual([])
    expect(mockProductFindMany).not.toHaveBeenCalled()
  })

  it('keeps the best ME/TE across owned copies of the same blueprint', async () => {
    mockBlueprintFindMany.mockResolvedValue([
      { typeId: 681, materialEfficiency: 2, timeEfficiency: 4 }, // Rifter BP copy
      { typeId: 681, materialEfficiency: 10, timeEfficiency: 20 }, // researched original
    ])
    mockProductFindMany.mockResolvedValue([{ blueprintTypeId: 681, typeId: 587 }]) // -> Rifter

    const { getOwnedBlueprintProducts } = await import('./owned-products')
    const result = await getOwnedBlueprintProducts('u1')

    expect(result).toEqual([{ productTypeId: 587, blueprintTypeId: 681, bestMe: 10, bestTe: 20 }])
  })

  it('maps each owned blueprint to its manufactured product', async () => {
    mockBlueprintFindMany.mockResolvedValue([
      { typeId: 681, materialEfficiency: 10, timeEfficiency: 20 },
      { typeId: 682, materialEfficiency: 0, timeEfficiency: 0 },
    ])
    mockProductFindMany.mockResolvedValue([
      { blueprintTypeId: 681, typeId: 587 },
      { blueprintTypeId: 682, typeId: 588 },
    ])

    const { getOwnedBlueprintProducts } = await import('./owned-products')
    const result = await getOwnedBlueprintProducts('u1')

    expect(result).toHaveLength(2)
    expect(result.map((r) => r.productTypeId).sort()).toEqual([587, 588])
    expect(mockBlueprintFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { character: { userId: 'u1' } } })
    )
  })

  it('drops owned blueprints with no manufacturing product (e.g. reaction/invention only)', async () => {
    mockBlueprintFindMany.mockResolvedValue([
      { typeId: 681, materialEfficiency: 10, timeEfficiency: 20 },
      { typeId: 999, materialEfficiency: 0, timeEfficiency: 0 },
    ])
    // only 681 has a manufacturing product row
    mockProductFindMany.mockResolvedValue([{ blueprintTypeId: 681, typeId: 587 }])

    const { getOwnedBlueprintProducts } = await import('./owned-products')
    const result = await getOwnedBlueprintProducts('u1')

    expect(result).toEqual([{ productTypeId: 587, blueprintTypeId: 681, bestMe: 10, bestTe: 20 }])
  })
})
