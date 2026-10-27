import { parseBlueprintLine } from '@/lib/sde/blueprint-import'

describe('parseBlueprintLine', () => {
  it('parses a manufacturing blueprint (materials, product, time)', () => {
    // Real shape from blueprints.jsonl (_key 681).
    const line = JSON.stringify({
      _key: 681,
      activities: {
        copying: { time: 480 },
        manufacturing: {
          materials: [{ quantity: 86, typeID: 38 }],
          products: [{ quantity: 1, typeID: 165 }],
          time: 600,
        },
        research_material: { time: 210 },
      },
      blueprintTypeID: 681,
      maxProductionLimit: 300,
    })
    const bp = parseBlueprintLine(line)!
    expect(bp.blueprintTypeId).toBe(681)
    expect(bp.maxProductionLimit).toBe(300)
    expect(bp.manufacturingTime).toBe(600)
    expect(bp.reactionTime).toBeNull()
    expect(bp.materials).toEqual([{ activity: 'manufacturing', typeId: 38, quantity: 86 }])
    expect(bp.products).toEqual([{ activity: 'manufacturing', typeId: 165, quantity: 1, probability: null }])
  })

  it('captures invention product probability and both activities separately', () => {
    const line = JSON.stringify({
      _key: 683,
      activities: {
        invention: {
          materials: [{ quantity: 2, typeID: 20416 }],
          products: [{ probability: 0.3, quantity: 1, typeID: 39581 }],
          time: 63900,
        },
        manufacturing: {
          materials: [{ quantity: 24000, typeID: 34 }],
          products: [{ quantity: 1, typeID: 582 }],
          time: 6000,
        },
      },
      blueprintTypeID: 683,
      maxProductionLimit: 30,
    })
    const bp = parseBlueprintLine(line)!
    expect(bp.manufacturingTime).toBe(6000)
    expect(bp.inventionTime).toBe(63900)
    expect(bp.materials).toContainEqual({ activity: 'invention', typeId: 20416, quantity: 2 })
    expect(bp.materials).toContainEqual({ activity: 'manufacturing', typeId: 34, quantity: 24000 })
    expect(bp.products).toContainEqual({ activity: 'invention', typeId: 39581, quantity: 1, probability: 0.3 })
    expect(bp.products).toContainEqual({ activity: 'manufacturing', typeId: 582, quantity: 1, probability: null })
  })

  it('parses a reaction blueprint', () => {
    const line = JSON.stringify({
      _key: 46001,
      activities: {
        reaction: {
          materials: [{ quantity: 100, typeID: 16657 }, { quantity: 100, typeID: 16661 }],
          products: [{ quantity: 20, typeID: 16672 }],
          time: 360,
        },
      },
      blueprintTypeID: 46001,
    })
    const bp = parseBlueprintLine(line)!
    expect(bp.reactionTime).toBe(360)
    expect(bp.materials).toHaveLength(2)
    expect(bp.products).toEqual([{ activity: 'reaction', typeId: 16672, quantity: 20, probability: null }])
  })

  it('ignores copying/research activities — they have no materials or products', () => {
    const line = JSON.stringify({
      _key: 999,
      activities: { copying: { time: 480 }, research_time: { time: 210 } },
      blueprintTypeID: 999,
    })
    const bp = parseBlueprintLine(line)!
    expect(bp.materials).toEqual([])
    expect(bp.products).toEqual([])
    expect(bp.manufacturingTime).toBeNull()
  })

  it('drops materials with a non-positive type or quantity (no zero placeholders)', () => {
    const line = JSON.stringify({
      _key: 1,
      activities: {
        manufacturing: {
          materials: [
            { quantity: 0, typeID: 34 }, // zero qty
            { quantity: 5, typeID: 0 }, // invalid type
            { quantity: 5, typeID: 35 }, // valid
          ],
          products: [{ quantity: 1, typeID: 100 }],
          time: 100,
        },
      },
      blueprintTypeID: 1,
    })
    const bp = parseBlueprintLine(line)!
    expect(bp.materials).toEqual([{ activity: 'manufacturing', typeId: 35, quantity: 5 }])
  })

  it('returns null for malformed JSON or a missing blueprint id', () => {
    expect(parseBlueprintLine('{ not json')).toBeNull()
    expect(parseBlueprintLine(JSON.stringify({ activities: {} }))).toBeNull()
  })

  it('falls back to _key when blueprintTypeID is absent', () => {
    const line = JSON.stringify({ _key: 42, activities: { manufacturing: { time: 5 } } })
    expect(parseBlueprintLine(line)!.blueprintTypeId).toBe(42)
  })
})
