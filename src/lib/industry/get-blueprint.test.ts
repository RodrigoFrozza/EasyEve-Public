const mockProductFindFirst = jest.fn()
const mockMaterialFindMany = jest.fn()
const mockEveTypeFindMany = jest.fn()
const mockBlueprintFindUnique = jest.fn()
const mockBlueprintFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    blueprintProduct: {
      findFirst: (...args: unknown[]) => mockProductFindFirst(...args),
      findMany: jest.fn(),
    },
    blueprintMaterial: {
      findMany: (...args: unknown[]) => mockMaterialFindMany(...args),
    },
    blueprint: {
      findUnique: (...args: unknown[]) => mockBlueprintFindUnique(...args),
      findMany: (...args: unknown[]) => mockBlueprintFindMany(...args),
    },
    eveType: {
      findMany: (...args: unknown[]) => mockEveTypeFindMany(...args),
    },
  },
}))

function namesFor(ids: number[]) {
  return ids.map((id) => ({ id, name: `Type ${id}` }))
}

describe('getProductionRecipe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEveTypeFindMany.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) =>
      namesFor(where.id.in)
    )
    mockBlueprintFindUnique.mockResolvedValue({ manufacturingTime: 600, reactionTime: 3600 })
    mockBlueprintFindMany.mockResolvedValue([])
  })

  it('resolves manufacturing first when a manufacturing product exists', async () => {
    const { getProductionRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockImplementation(async ({ where }: { where: { activity: string } }) => {
      if (where.activity === 'manufacturing') return { blueprintTypeId: 10, quantity: 1 }
      return null
    })
    mockMaterialFindMany.mockResolvedValue([{ typeId: 34, quantity: 100 }])

    const recipe = await getProductionRecipe(587)

    expect(recipe?.activity).toBe('manufacturing')
    expect(recipe?.blueprintTypeId).toBe(10)
    // Manufacturing recipe carries the SDE manufacturing time.
    expect(recipe?.baseTimeSeconds).toBe(600)
    expect(mockProductFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { typeId: 587, activity: 'manufacturing' } })
    )
    // Never even tries the reaction path once manufacturing hits.
    expect(mockProductFindFirst).toHaveBeenCalledTimes(1)
  })

  it('falls back to reaction when no manufacturing product exists', async () => {
    const { getProductionRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockImplementation(async ({ where }: { where: { activity: string } }) => {
      if (where.activity === 'manufacturing') return null
      return { blueprintTypeId: 99, quantity: 100 }
    })
    mockMaterialFindMany.mockImplementation(async ({ where }: { where: { activity: string } }) => {
      expect(where.activity).toBe('reaction')
      return [{ typeId: 16634, quantity: 40 }]
    })

    const recipe = await getProductionRecipe(16662)

    expect(recipe?.activity).toBe('reaction')
    expect(recipe?.blueprintTypeId).toBe(99)
    // Reaction recipe carries the SDE reaction time, not the manufacturing time.
    expect(recipe?.baseTimeSeconds).toBe(3600)
    expect(mockProductFindFirst).toHaveBeenCalledTimes(2)
  })

  it('filters materials by the SAME activity the product was resolved with', async () => {
    const { getProductionRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockImplementation(async ({ where }: { where: { activity: string } }) =>
      where.activity === 'reaction' ? { blueprintTypeId: 5, quantity: 1 } : null
    )
    mockMaterialFindMany.mockResolvedValue([{ typeId: 1, quantity: 1 }])

    await getProductionRecipe(1)

    expect(mockMaterialFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { blueprintTypeId: 5, activity: 'reaction' } })
    )
  })

  it('returns null when neither manufacturing nor reaction produces the type', async () => {
    const { getProductionRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockResolvedValue(null)

    const recipe = await getProductionRecipe(123456)

    expect(recipe).toBeNull()
    expect(mockMaterialFindMany).not.toHaveBeenCalled()
  })

  it('rejects non-positive/non-integer type ids without querying', async () => {
    const { getProductionRecipe } = await import('./get-blueprint')

    expect(await getProductionRecipe(0)).toBeNull()
    expect(await getProductionRecipe(-5)).toBeNull()
    expect(await getProductionRecipe(1.5)).toBeNull()
    expect(mockProductFindFirst).not.toHaveBeenCalled()
  })
})

describe('getManufacturingRecipe', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEveTypeFindMany.mockImplementation(async ({ where }: { where: { id: { in: number[] } } }) =>
      namesFor(where.id.in)
    )
    mockBlueprintFindUnique.mockResolvedValue({ manufacturingTime: 600, reactionTime: 3600 })
    mockBlueprintFindMany.mockResolvedValue([])
  })

  it('only ever queries the manufacturing activity (unchanged behavior)', async () => {
    const { getManufacturingRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockResolvedValue({ blueprintTypeId: 10, quantity: 1 })
    mockMaterialFindMany.mockResolvedValue([])

    await getManufacturingRecipe(587)

    expect(mockProductFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { typeId: 587, activity: 'manufacturing' } })
    )
    expect(mockProductFindFirst).toHaveBeenCalledTimes(1)
  })

  it('returns null and never falls back to reaction when there is no manufacturing product', async () => {
    const { getManufacturingRecipe } = await import('./get-blueprint')

    mockProductFindFirst.mockResolvedValue(null)

    const recipe = await getManufacturingRecipe(16662)

    expect(recipe).toBeNull()
    expect(mockProductFindFirst).toHaveBeenCalledTimes(1)
  })
})
