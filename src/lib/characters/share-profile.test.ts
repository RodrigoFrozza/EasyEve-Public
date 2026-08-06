const mockPrisma = {
  character: {
    findFirst: jest.fn(),
  },
}

jest.mock('@/lib/prisma', () => ({
  prisma: mockPrisma,
}))

// Loaded dynamically (not a static top-level import) so the module — which
// requires '@/lib/prisma' at import time — isn't pulled in before mockPrisma
// above has actually been initialized.
let toSharedProfileDto: typeof import('./share-profile').toSharedProfileDto
let toOwnerProfileDto: typeof import('./share-profile').toOwnerProfileDto
let getSharedProfileByToken: typeof import('./share-profile').getSharedProfileByToken

beforeAll(async () => {
  ;({ toSharedProfileDto, toOwnerProfileDto, getSharedProfileByToken } = await import('./share-profile'))
})

// A "hostile" source object shaped like a full Prisma `Character` row, carrying
// every sensitive field the DTO builders must never leak. This is intentionally
// wider than the CharacterProfileSource interface to prove the mappers only
// ever read the allow-listed fields even when handed the real row.
function fullCharacterRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 900001,
    name: 'Pilot Alpha',
    corporationId: 1001,
    birthday: new Date('2020-01-01T00:00:00.000Z'),
    raceId: 1,
    bloodlineId: 2,
    gender: 'male',
    securityStatus: 1.2,
    isOmega: true,
    shareToken: 'the-actual-share-token',
    snapshot: {
      totalSp: 5_000_000,
      unallocatedSp: 10_000,
      skills: [{ skill_id: 3300 }],
      skillqueue: [{ skill_id: 3301 }],
      attributes: { charisma: 20 },
      implants: [19540],
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    },
    // --- sensitive fields that must NEVER reach either DTO ---
    accessToken: 'secret-access-token',
    refreshToken: 'secret-refresh-token',
    walletBalance: 999_999_999,
    location: 'Jita IV - Moon 4',
    ship: 'Rifter',
    userId: 'owner-user-id',
    ownerHash: 'eve-sso-owner-hash',
    ...overrides,
  }
}

const SENSITIVE_KEYS = [
  'accessToken',
  'refreshToken',
  'walletBalance',
  'location',
  'ship',
  'userId',
  'ownerHash',
]

describe('toSharedProfileDto', () => {
  it('never leaks sensitive fields even when given a full Character row', () => {
    const result = toSharedProfileDto(fullCharacterRow() as any)

    for (const key of SENSITIVE_KEYS) {
      expect(result).not.toHaveProperty(key)
    }
    // shareToken is sensitive-adjacent (the secret link itself) and must also
    // be absent from the PUBLIC dto — only toOwnerProfileDto may surface it.
    expect(result).not.toHaveProperty('shareToken')
  })

  it('maps the safe fields through, including snapshot-derived values', () => {
    const result = toSharedProfileDto(fullCharacterRow() as any)

    expect(result).toEqual({
      name: 'Pilot Alpha',
      characterId: 900001,
      corporationId: 1001,
      birthday: new Date('2020-01-01T00:00:00.000Z'),
      raceId: 1,
      bloodlineId: 2,
      gender: 'male',
      securityStatus: 1.2,
      isOmega: true,
      totalSp: 5_000_000,
      unallocatedSp: 10_000,
      skills: [{ skill_id: 3300 }],
      skillqueue: [{ skill_id: 3301 }],
      attributes: { charisma: 20 },
      implants: [19540],
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    })
  })

  it('degrades snapshot-derived fields to null when there is no snapshot yet (not fabricated zeros)', () => {
    const result = toSharedProfileDto(fullCharacterRow({ snapshot: null }) as any)

    expect(result.totalSp).toBeNull()
    expect(result.unallocatedSp).toBeNull()
    expect(result.skills).toBeNull()
    expect(result.skillqueue).toBeNull()
    expect(result.attributes).toBeNull()
    expect(result.implants).toBeNull()
    expect(result.capturedAt).toBeNull()
  })
})

describe('toOwnerProfileDto', () => {
  it('includes shareToken and missingScopes on top of the safe fields, still without other sensitive fields', () => {
    const result = toOwnerProfileDto(fullCharacterRow() as any, ['esi-clones.read_implants.v1'])

    expect(result.shareToken).toBe('the-actual-share-token')
    expect(result.missingScopes).toEqual(['esi-clones.read_implants.v1'])

    for (const key of SENSITIVE_KEYS) {
      expect(result).not.toHaveProperty(key)
    }
  })

  it('defaults missingScopes to an empty array when not provided', () => {
    const result = toOwnerProfileDto(fullCharacterRow() as any)

    expect(result.missingScopes).toEqual([])
  })
})

describe('getSharedProfileByToken', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns null without querying Prisma when the token is empty', async () => {
    const result = await getSharedProfileByToken('')

    expect(result).toBeNull()
    expect(mockPrisma.character.findFirst).not.toHaveBeenCalled()
  })

  it('returns null when the token does not match any character', async () => {
    mockPrisma.character.findFirst.mockResolvedValue(null)

    const result = await getSharedProfileByToken('unknown-token')

    expect(result).toBeNull()
    expect(mockPrisma.character.findFirst).toHaveBeenCalledWith({
      where: { shareToken: 'unknown-token' },
      include: { snapshot: true },
    })
  })

  it('returns null when the matched character has since had sharing disabled/rotated away (shareToken cleared)', async () => {
    // Simulates a race: the row was found by a token that has just been nulled
    // out by a concurrent 'disable'/'rotate' — must behave exactly like an
    // unknown token (404), never return a partial profile.
    mockPrisma.character.findFirst.mockResolvedValue({
      ...fullCharacterRow(),
      shareToken: null,
    })

    const result = await getSharedProfileByToken('stale-token')

    expect(result).toBeNull()
  })

  it('returns the safe DTO when the token resolves to a character with sharing enabled', async () => {
    mockPrisma.character.findFirst.mockResolvedValue(fullCharacterRow())

    const result = await getSharedProfileByToken('the-actual-share-token')

    expect(result).not.toBeNull()
    expect(result?.name).toBe('Pilot Alpha')
    expect(result).not.toHaveProperty('accessToken')
    expect(result).not.toHaveProperty('shareToken')
  })
})
