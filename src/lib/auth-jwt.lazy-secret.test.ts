describe('auth-jwt lazy secret resolution', () => {
  it('throws on createJWT when NEXTAUTH_SECRET is missing in production', async () => {
    jest.resetModules()
    const prevNode = process.env.NODE_ENV
    const prevSecret = process.env.NEXTAUTH_SECRET
    process.env.NODE_ENV = 'production'
    delete process.env.NEXTAUTH_SECRET

    const { createJWT } = await import('./auth-jwt')
    await expect(createJWT('user-1', 1, 'owner-hash')).rejects.toThrow(
      '[AUTH-JWT] NEXTAUTH_SECRET is required in production environment',
    )

    process.env.NODE_ENV = prevNode
    if (prevSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET
    } else {
      process.env.NEXTAUTH_SECRET = prevSecret
    }
  })

  it('throws on createJWT when NEXTAUTH_SECRET is too short in production', async () => {
    jest.resetModules()
    const prevNode = process.env.NODE_ENV
    const prevSecret = process.env.NEXTAUTH_SECRET
    process.env.NODE_ENV = 'production'
    process.env.NEXTAUTH_SECRET = 'short'

    const { createJWT } = await import('./auth-jwt')
    await expect(createJWT('user-1', 1, 'owner-hash')).rejects.toThrow(
      '[AUTH-JWT] NEXTAUTH_SECRET must be at least 32 characters for security',
    )

    process.env.NODE_ENV = prevNode
    if (prevSecret === undefined) {
      delete process.env.NEXTAUTH_SECRET
    } else {
      process.env.NEXTAUTH_SECRET = prevSecret
    }
  })
})
