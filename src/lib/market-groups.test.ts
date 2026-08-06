const mockEveMarketGroupFindMany = jest.fn()
const mockEveTypeFindMany = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    eveMarketGroup: {
      findMany: (...args: unknown[]) => mockEveMarketGroupFindMany(...args),
    },
    eveType: {
      findMany: (...args: unknown[]) => mockEveTypeFindMany(...args),
    },
  },
}))

describe('buildLocalMarketGroupTree', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('nests groups by parentGroupId and attaches published types as items', async () => {
    // Root (1) > Child (2) > Grandchild (3, has the only items)
    mockEveMarketGroupFindMany.mockResolvedValue([
      { id: 1, name: 'Ship Equipment', description: null, parentGroupId: null },
      { id: 2, name: 'Turrets & Bays', description: null, parentGroupId: 1 },
      { id: 3, name: 'Projectile Weapons', description: null, parentGroupId: 2 },
    ])
    mockEveTypeFindMany.mockResolvedValue([
      {
        id: 100,
        name: '125mm Gatling AutoCannon I',
        groupId: 55,
        volume: 5,
        marketGroupId: 3,
        group: { name: 'Projectile Weapon' },
      },
      {
        id: 101,
        name: '150mm Light AutoCannon I',
        groupId: 55,
        volume: 5,
        marketGroupId: 3,
        group: { name: 'Projectile Weapon' },
      },
    ])

    const { buildLocalMarketGroupTree } = await import('./market-groups')
    const { tree, itemCount } = await buildLocalMarketGroupTree()

    expect(itemCount).toBe(2)
    expect(tree).toHaveLength(1)

    const root = tree[0]
    expect(root.id).toBe(1)
    expect(root.name).toBe('Ship Equipment')
    expect(root.items).toEqual([])
    expect(root.children).toHaveLength(1)

    const child = root.children[0]
    expect(child.id).toBe(2)
    expect(child.items).toEqual([])
    expect(child.children).toHaveLength(1)

    const grandchild = child.children[0]
    expect(grandchild.id).toBe(3)
    expect(grandchild.items).toHaveLength(2)
    expect(grandchild.items[0]).toEqual({
      typeId: 100,
      name: '125mm Gatling AutoCannon I',
      groupId: 55,
      groupName: 'Projectile Weapon',
      volume: 5,
    })
  })

  it('omits branches that have no items anywhere in their subtree, recursively', async () => {
    // Root A has items further down; Root B (and its empty child) has none and must be pruned entirely.
    mockEveMarketGroupFindMany.mockResolvedValue([
      { id: 1, name: 'Root A', description: null, parentGroupId: null },
      { id: 2, name: 'Child of A', description: null, parentGroupId: 1 },
      { id: 3, name: 'Root B (empty)', description: null, parentGroupId: null },
      { id: 4, name: 'Child of B (empty)', description: null, parentGroupId: 3 },
    ])
    mockEveTypeFindMany.mockResolvedValue([
      {
        id: 200,
        name: 'Widget',
        groupId: 10,
        volume: 1,
        marketGroupId: 2,
        group: { name: 'Widgets' },
      },
    ])

    const { buildLocalMarketGroupTree } = await import('./market-groups')
    const { tree, itemCount } = await buildLocalMarketGroupTree()

    expect(itemCount).toBe(1)
    expect(tree).toHaveLength(1)
    expect(tree[0].id).toBe(1)
    expect(tree[0].children).toHaveLength(1)
    expect(tree[0].children[0].items).toHaveLength(1)
    // Root B and its child never appear anywhere in the result.
    expect(tree.some(n => n.id === 3)).toBe(false)
  })

  it('throws MarketGroupsEmptyError instead of silently returning an empty tree when EveMarketGroup has no rows', async () => {
    mockEveMarketGroupFindMany.mockResolvedValue([])
    mockEveTypeFindMany.mockResolvedValue([])

    const { buildLocalMarketGroupTree, MarketGroupsEmptyError } = await import('./market-groups')

    await expect(buildLocalMarketGroupTree()).rejects.toThrow(MarketGroupsEmptyError)
  })

  it('treats a type pointing at a non-existent market group id as unresolved rather than guessing', async () => {
    mockEveMarketGroupFindMany.mockResolvedValue([
      { id: 1, name: 'Root A', description: null, parentGroupId: null },
    ])
    mockEveTypeFindMany.mockResolvedValue([
      {
        id: 300,
        name: 'Orphan Item',
        groupId: 10,
        volume: 1,
        marketGroupId: 999, // does not exist in marketGroups
        group: { name: 'Whatever' },
      },
    ])

    const { buildLocalMarketGroupTree } = await import('./market-groups')
    const { tree, itemCount } = await buildLocalMarketGroupTree()

    // Root A has no items and no children -> pruned; orphan item is dropped, not fabricated a home.
    expect(itemCount).toBe(0)
    expect(tree).toHaveLength(0)
  })
})
