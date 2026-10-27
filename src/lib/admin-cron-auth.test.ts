import { cronSecretMatches } from './admin-cron-auth'

const ORIGINAL_ENV = process.env

function makeRequest(url: string, headers: Record<string, string> = {}): Request {
  const lower = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
  return {
    url,
    headers: { get: (name: string) => lower.get(name.toLowerCase()) ?? null },
  } as unknown as Request
}

describe('cronSecretMatches', () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, CRON_SECRET: 'super-secret' }
  })

  afterAll(() => {
    process.env = ORIGINAL_ENV
  })

  it('accepts a matching Authorization: Bearer header', () => {
    const req = makeRequest('https://example.com/api/x', { authorization: 'Bearer super-secret' })
    expect(cronSecretMatches(req)).toBe(true)
  })

  it('accepts the legacy ?token= query string as a fallback', () => {
    const req = makeRequest('https://example.com/api/x?token=super-secret')
    expect(cronSecretMatches(req)).toBe(true)
  })

  it('rejects a mismatched header', () => {
    const req = makeRequest('https://example.com/api/x', { authorization: 'Bearer wrong-value' })
    expect(cronSecretMatches(req)).toBe(false)
  })

  it('rejects when CRON_SECRET is not configured, even if a token is supplied', () => {
    delete process.env.CRON_SECRET
    const req = makeRequest('https://example.com/api/x?token=anything')
    expect(cronSecretMatches(req)).toBe(false)
  })
})
