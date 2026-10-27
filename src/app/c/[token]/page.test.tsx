const mockGetSharedProfileByToken = jest.fn()
jest.mock('@/lib/characters/share-profile', () => ({
  getSharedProfileByToken: (...args: unknown[]) => mockGetSharedProfileByToken(...args),
}))
// The page body is not rendered here — these only keep next/headers and the
// client-side profile view out of the jsdom import graph.
jest.mock('@/i18n/server', () => ({
  getTranslations: jest.fn(),
}))
jest.mock('@/components/characters/profile/CharacterProfileView', () => ({
  CharacterProfileView: () => null,
}))

describe('generateMetadata for /c/[token]', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('uses the character name and portrait for the OG/Twitter card when the token resolves', async () => {
    mockGetSharedProfileByToken.mockResolvedValue({ name: 'Pilot Alpha', characterId: 900001 })
    const { generateMetadata } = await import('./page')

    const metadata = await generateMetadata({ params: Promise.resolve({ token: 'good-token' }) })

    const portrait = 'https://images.evetech.net/characters/900001/portrait?size=256'
    expect(mockGetSharedProfileByToken).toHaveBeenCalledWith('good-token')
    expect(metadata.title).toBe('Pilot Alpha | EasyEve')
    expect(metadata.description).toContain('Pilot Alpha')
    expect(metadata.robots).toBe('noindex, nofollow')
    expect(metadata.openGraph?.title).toBe('Pilot Alpha')
    expect(metadata.openGraph?.url).toMatch(/\/c\/good-token$/)
    expect(metadata.openGraph?.images).toEqual([portrait])
    expect(metadata.twitter?.images).toEqual([portrait])
  })

  it('returns a generic noindex title without any character data when the token does not resolve', async () => {
    mockGetSharedProfileByToken.mockResolvedValue(null)
    const { generateMetadata } = await import('./page')

    const metadata = await generateMetadata({ params: Promise.resolve({ token: 'bad-token' }) })

    expect(metadata).toEqual({ title: 'Profile Not Found | EasyEve', robots: 'noindex, nofollow' })
  })
})
