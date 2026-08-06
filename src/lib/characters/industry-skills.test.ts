const mockFindUnique = jest.fn()

jest.mock('@/lib/prisma', () => ({
  prisma: {
    characterSnapshot: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}))

jest.mock('@/lib/server-logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

const CAPTURED = new Date('2026-07-18T10:00:00Z')

describe('getIndustrySkillLevels', () => {
  beforeEach(() => jest.clearAllMocks())

  it('extracts Industry (3380) and Advanced Industry (3388) levels', async () => {
    mockFindUnique.mockResolvedValue({
      capturedAt: CAPTURED,
      skills: [
        { skill_id: 3380, trained_skill_level: 5, active_skill_level: 5 },
        { skill_id: 3388, trained_skill_level: 4, active_skill_level: 4 },
        { skill_id: 3300, trained_skill_level: 3, active_skill_level: 3 },
      ],
    })

    const { getIndustrySkillLevels } = await import('./industry-skills')
    const result = await getIndustrySkillLevels(90000001)

    expect(result).toEqual({ industry: 5, advancedIndustry: 4, capturedAt: CAPTURED })
  })

  it('prefers active over trained level, and treats an untrained skill as 0', async () => {
    mockFindUnique.mockResolvedValue({
      capturedAt: CAPTURED,
      skills: [{ skill_id: 3380, trained_skill_level: 5, active_skill_level: 3 }],
      // 3388 absent entirely -> 0
    })

    const { getIndustrySkillLevels } = await import('./industry-skills')
    const result = await getIndustrySkillLevels(90000001)

    expect(result).toMatchObject({ industry: 3, advancedIndustry: 0 })
  })

  it('returns null when there is no snapshot (no data != level 0)', async () => {
    mockFindUnique.mockResolvedValue(null)

    const { getIndustrySkillLevels } = await import('./industry-skills')
    expect(await getIndustrySkillLevels(90000001)).toBeNull()
  })

  it('returns null (not a throw) on a DB error', async () => {
    mockFindUnique.mockRejectedValue(new Error('db down'))

    const { getIndustrySkillLevels } = await import('./industry-skills')
    expect(await getIndustrySkillLevels(90000001)).toBeNull()
  })

  it('handles a snapshot whose skills column is not an array', async () => {
    mockFindUnique.mockResolvedValue({ capturedAt: CAPTURED, skills: null })

    const { getIndustrySkillLevels } = await import('./industry-skills')
    const result = await getIndustrySkillLevels(90000001)

    expect(result).toMatchObject({ industry: 0, advancedIndustry: 0 })
  })
})
