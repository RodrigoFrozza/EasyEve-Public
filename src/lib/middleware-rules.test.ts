import { getForbiddenReason, isPublicRoute } from './middleware-rules'

describe('isPublicRoute', () => {
  it('matches the home page only exactly', () => {
    expect(isPublicRoute('/')).toBe(true)
    // The bug: '/' as a prefix made every path public.
    expect(isPublicRoute('/dashboard')).toBe(false)
    expect(isPublicRoute('/api/news')).toBe(false)
  })

  it('keeps the login and SSO routes public', () => {
    expect(isPublicRoute('/login')).toBe(true)
    expect(isPublicRoute('/api/auth/signin')).toBe(true)
    expect(isPublicRoute('/api/auth/callback/holding')).toBe(true)
    expect(isPublicRoute('/api/auth/session')).toBe(true)
  })
})

describe('getForbiddenReason', () => {
  const base = { origin: null, referer: null, host: 'easyeve.cloud' }

  it('refuses a cross-site browser call to an internal API', () => {
    expect(getForbiddenReason({ ...base, pathname: '/api/news', origin: 'https://evil.example' })).toBe(
      'ORIGIN_MISMATCH'
    )
    expect(getForbiddenReason({ ...base, pathname: '/api/news', referer: 'https://evil.example/page' })).toBe(
      'REFERER_MISMATCH'
    )
  })

  it('allows same-site browser calls', () => {
    expect(
      getForbiddenReason({
        pathname: '/api/news',
        origin: 'https://easyeve.cloud',
        referer: 'https://easyeve.cloud/dashboard',
        host: 'easyeve.cloud',
      })
    ).toBeNull()
  })

  it('allows server-to-server callers that send no Origin/Referer (cron, MCP)', () => {
    expect(getForbiddenReason({ ...base, pathname: '/api/admin/scripts/scheduler/trigger' })).toBeNull()
    expect(getForbiddenReason({ ...base, pathname: '/api/mcp' })).toBeNull()
  })

  it('never blocks the SSO flow or the key-authenticated external API', () => {
    expect(
      getForbiddenReason({ ...base, pathname: '/api/auth/callback/eveonline', referer: 'https://login.eveonline.com/' })
    ).toBeNull()
    expect(
      getForbiddenReason({ ...base, pathname: '/api/external/v1/fitting', origin: 'https://partner.example' })
    ).toBeNull()
  })

  it('lets webhooks through on Referer only', () => {
    expect(getForbiddenReason({ ...base, pathname: '/api/webhooks/x', referer: 'https://github.com' })).toBeNull()
    expect(getForbiddenReason({ ...base, pathname: '/api/webhooks/x', origin: 'https://github.com' })).toBe(
      'ORIGIN_MISMATCH'
    )
  })

  it('ignores non-API paths', () => {
    expect(getForbiddenReason({ ...base, pathname: '/dashboard', origin: 'https://evil.example' })).toBeNull()
  })
})
