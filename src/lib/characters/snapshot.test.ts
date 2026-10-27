const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
jest.mock('@/lib/server-logger', () => ({ logger: mockLogger }))

const mockGetValidAccessToken = jest.fn()
jest.mock('@/lib/token-manager', () => ({
  getValidAccessToken: (...args: unknown[]) => mockGetValidAccessToken(...args),
}))

const mockGetCharacterSkills = jest.fn()
const mockGetCharacterAttributes = jest.fn()
const mockGetCharacterImplants = jest.fn()
jest.mock('@/lib/esi', () => ({
  getCharacterSkills: (...args: unknown[]) => mockGetCharacterSkills(...args),
  getCharacterAttributes: (...args: unknown[]) => mockGetCharacterAttributes(...args),
  getCharacterImplants: (...args: unknown[]) => mockGetCharacterImplants(...args),
}))

const mockParseScopesFromJwt = jest.fn()
jest.mock('@/lib/utils', () => ({
  parseScopesFromJwt: (...args: unknown[]) => mockParseScopesFromJwt(...args),
}))

const mockPrisma = {
  characterSnapshot: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
}
jest.mock('@/lib/prisma', () => ({ prisma: mockPrisma }))

// Loaded dynamically (not a static top-level import) so './snapshot' — which
// requires '@/lib/prisma' at import time — isn't pulled in before mockPrisma
// above has actually been initialized.
let writeCharacterSnapshot: typeof import('./snapshot').writeCharacterSnapshot

beforeAll(async () => {
  ;({ writeCharacterSnapshot } = await import('./snapshot'))
})

const SKILLS_SCOPE = 'esi-skills.read_skills.v1'
const SKILLQUEUE_SCOPE = 'esi-skills.read_skillqueue.v1'
const IMPLANTS_SCOPE = 'esi-clones.read_implants.v1'

describe('writeCharacterSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGetValidAccessToken.mockResolvedValue({ accessToken: 'fake.jwt.token' })
    mockPrisma.characterSnapshot.upsert.mockResolvedValue({ id: 'snap-1' })
  })

  it('happy path: all scopes present -> fetches skills/attributes/implants and reports no missing scopes', async () => {
    mockParseScopesFromJwt.mockReturnValue([SKILLS_SCOPE, SKILLQUEUE_SCOPE, IMPLANTS_SCOPE])
    mockGetCharacterSkills.mockResolvedValue({
      total_sp: 5_000_000,
      free_sp: 10_000,
      skills: [{ skill_id: 3300, skillpoints_in_skill: 1000, trained_skill_level: 3, active_skill_level: 3 }],
      queues: [{ skill_id: 3301, finished_level: 4, queue_position: 0 }],
    })
    mockGetCharacterAttributes.mockResolvedValue({
      charisma: 20,
      intelligence: 21,
      memory: 22,
      perception: 23,
      willpower: 24,
    })
    mockGetCharacterImplants.mockResolvedValue([19540, 19551])
    mockPrisma.characterSnapshot.findUnique.mockResolvedValue(null)

    const result = await writeCharacterSnapshot({ id: 42 })

    expect(result.missingScopes).toEqual([])
    expect(mockGetCharacterSkills).toHaveBeenCalledWith(42, 'fake.jwt.token')
    expect(mockGetCharacterAttributes).toHaveBeenCalledWith(42, 'fake.jwt.token')
    expect(mockGetCharacterImplants).toHaveBeenCalledWith(42, 'fake.jwt.token')

    const upsertArgs = mockPrisma.characterSnapshot.upsert.mock.calls[0][0]
    expect(upsertArgs.where).toEqual({ characterId: 42 })
    expect(upsertArgs.create.totalSp).toBe(5_000_000)
    expect(upsertArgs.create.unallocatedSp).toBe(10_000)
    expect(upsertArgs.create.skills).toEqual([
      { skill_id: 3300, skillpoints_in_skill: 1000, trained_skill_level: 3, active_skill_level: 3 },
    ])
    expect(upsertArgs.create.skillqueue).toEqual([{ skill_id: 3301, finished_level: 4, queue_position: 0 }])
    expect(upsertArgs.create.attributes).toEqual({
      charisma: 20,
      intelligence: 21,
      memory: 22,
      perception: 23,
      willpower: 24,
    })
    expect(upsertArgs.create.implants).toEqual([19540, 19551])
  })

  it('degrades when esi-clones.read_implants.v1 is missing: skips the implants fetch, reports the scope, and does not derail the rest', async () => {
    mockParseScopesFromJwt.mockReturnValue([SKILLS_SCOPE, SKILLQUEUE_SCOPE]) // no implants scope
    mockGetCharacterSkills.mockResolvedValue({
      total_sp: 1_000,
      free_sp: 0,
      skills: [],
      queues: [],
    })
    mockGetCharacterAttributes.mockResolvedValue({
      charisma: 1,
      intelligence: 1,
      memory: 1,
      perception: 1,
      willpower: 1,
    })
    // Existing persisted snapshot already has implants from a previous successful sync.
    mockPrisma.characterSnapshot.findUnique.mockResolvedValue({
      id: 'snap-1',
      characterId: 42,
      totalSp: 500,
      unallocatedSp: 0,
      skills: [],
      skillqueue: [],
      attributes: {},
      implants: [19540],
      capturedAt: new Date('2026-07-01T00:00:00.000Z'),
    })

    const result = await writeCharacterSnapshot({ id: 42 })

    expect(mockGetCharacterImplants).not.toHaveBeenCalled()
    expect(result.missingScopes).toContain(IMPLANTS_SCOPE)

    const upsertArgs = mockPrisma.characterSnapshot.upsert.mock.calls[0][0]
    // The rest of the snapshot still refreshes normally.
    expect(upsertArgs.update.skills).toEqual([])
    expect(upsertArgs.update.attributes).toEqual({
      charisma: 1,
      intelligence: 1,
      memory: 1,
      perception: 1,
      willpower: 1,
    })
    // 'implants' must be entirely absent from the update payload — that's what
    // makes Prisma leave the previously persisted value untouched instead of
    // overwriting it with a fabricated one.
    expect(upsertArgs.update).not.toHaveProperty('implants')
  })

  it('on a brand-new snapshot (no prior record) does not fabricate an implants value when the scope is missing', async () => {
    mockParseScopesFromJwt.mockReturnValue([SKILLS_SCOPE, SKILLQUEUE_SCOPE])
    mockGetCharacterSkills.mockResolvedValue({ total_sp: 0, free_sp: 0, skills: [], queues: [] })
    mockGetCharacterAttributes.mockResolvedValue({
      charisma: 1,
      intelligence: 1,
      memory: 1,
      perception: 1,
      willpower: 1,
    })
    mockPrisma.characterSnapshot.findUnique.mockResolvedValue(null)

    await writeCharacterSnapshot({ id: 42 })

    const upsertArgs = mockPrisma.characterSnapshot.upsert.mock.calls[0][0]
    // NOTE: current code sets `implants: implantsResult ?? undefined` on create,
    // i.e. the key is explicitly undefined (Prisma treats that as "not
    // provided") rather than an empty array. This is called out in the report:
    // it's arguably correct per the "never fabricate data" rule (an empty array
    // would falsely claim "confirmed zero implants"), but it does not literally
    // match "[] on create" as described in the task brief.
    expect(upsertArgs.create.implants).toBeUndefined()
  })

  it('propagates a non-403 ESI error (e.g. an outage) instead of swallowing it into a partial snapshot', async () => {
    mockParseScopesFromJwt.mockReturnValue([SKILLS_SCOPE, SKILLQUEUE_SCOPE, IMPLANTS_SCOPE])
    const outageError = Object.assign(new Error('ESI outage'), { response: { status: 500 } })
    mockGetCharacterSkills.mockRejectedValue(outageError)
    mockGetCharacterAttributes.mockResolvedValue({
      charisma: 1,
      intelligence: 1,
      memory: 1,
      perception: 1,
      willpower: 1,
    })
    mockGetCharacterImplants.mockResolvedValue([])
    mockPrisma.characterSnapshot.findUnique.mockResolvedValue(null)

    await expect(writeCharacterSnapshot({ id: 42 })).rejects.toThrow('ESI outage')
    expect(mockPrisma.characterSnapshot.upsert).not.toHaveBeenCalled()
  })

  it('throws when no valid access token is available (does not silently produce an empty snapshot)', async () => {
    mockGetValidAccessToken.mockResolvedValue({ accessToken: null, error: 'expired' })

    await expect(writeCharacterSnapshot({ id: 42 })).rejects.toThrow()
    expect(mockPrisma.characterSnapshot.upsert).not.toHaveBeenCalled()
  })
})
