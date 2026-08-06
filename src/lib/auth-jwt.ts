import { SignJWT, jwtVerify } from 'jose'

function resolveJWTSecret(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[AUTH-JWT] NEXTAUTH_SECRET is required in production environment')
    }

    console.warn('[AUTH-JWT] ⚠️ Using insecure fallback secret. Set NEXTAUTH_SECRET in production!')
    return new TextEncoder().encode('dev-only-fallback-secret-do-not-use-in-prod')
  }

  if (secret.length < 32) {
    throw new Error('[AUTH-JWT] NEXTAUTH_SECRET must be at least 32 characters for security')
  }

  return new TextEncoder().encode(secret)
}

let jwtSecretCache: Uint8Array | null = null

function getJWTSecretBytes(): Uint8Array {
  if (!jwtSecretCache) {
    jwtSecretCache = resolveJWTSecret()
  }
  return jwtSecretCache
}

export interface JWTPayload {
  userId: string
  characterId: number
  ownerHash: string
  iat?: number
  exp?: number
}

export async function createJWT(
  userId: string,
  characterId: number,
  ownerHash: string
): Promise<string> {
  return new SignJWT({
    userId,
    characterId,
    ownerHash,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJWTSecretBytes())
}

export async function verifyJWT(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJWTSecretBytes())
    return {
      userId: payload.userId as string,
      characterId: payload.characterId as number,
      ownerHash: payload.ownerHash as string,
      iat: payload.iat,
      exp: payload.exp,
    }
  } catch {
    return null
  }
}

export function createSessionCookie(token: string): string {
  const isSecure = process.env.NEXT_PUBLIC_APP_ENV === 'production'
  return `session=${token}; ` +
    `HttpOnly; ` +
    (isSecure ? `Secure; ` : '') +
    `SameSite=Lax; ` +
    `Path=/; ` +
    `Max-Age=${8 * 60 * 60}`
}

export function clearSessionCookie(): string {
  const isSecure = process.env.NEXT_PUBLIC_APP_ENV === 'production'
  return `session=; ` +
    `HttpOnly; ` +
    (isSecure ? `Secure; ` : '') +
    `SameSite=Lax; ` +
    `Path=/; ` +
    `Max-Age=0`
}
