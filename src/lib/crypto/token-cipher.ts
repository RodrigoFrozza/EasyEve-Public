import crypto from 'crypto'

/**
 * At-rest encryption for ESI OAuth tokens (Character.accessToken / refreshToken).
 * Format: "v1:<iv-base64>:<authTag-base64>:<ciphertext-base64>"
 * Values without the "v1:" prefix are treated as legacy plaintext (written before
 * this module existed) and passed through unchanged on decrypt, so no backfill
 * migration is required — rows self-heal as tokens are naturally refreshed.
 */

const ALGORITHM = 'aes-256-gcm'
const FORMAT_PREFIX = 'v1'
const IV_LENGTH = 12

function resolveKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY

  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('[TokenCipher] TOKEN_ENCRYPTION_KEY is required in production environment')
    }
    console.warn('[TokenCipher] ⚠️ Using insecure fallback key. Set TOKEN_ENCRYPTION_KEY in production!')
    return crypto.createHash('sha256').update('dev-only-fallback-token-key-do-not-use-in-prod').digest()
  }

  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) {
    throw new Error('[TokenCipher] TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded). Generate one with: openssl rand -base64 32')
  }

  return key
}

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = resolveKey()
  }
  return cachedKey
}

export function encryptToken(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [FORMAT_PREFIX, iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':')
}

/**
 * Resilient variant of decryptToken: returns null instead of throwing when the
 * value is missing or fails to decrypt (e.g. after a key rotation or DB
 * corruption). Use in batch/hot paths where a thrown decrypt error would
 * cascade — a single bad token should degrade that one operation, not crash the
 * whole request (or every character in a Promise.all).
 */
export function safeDecryptToken(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    return decryptToken(value)
  } catch {
    console.warn('[TokenCipher] safeDecryptToken failed; treating token as invalid')
    return null
  }
}

export function decryptToken(value: string): string {
  if (!value.startsWith(`${FORMAT_PREFIX}:`)) {
    return value
  }

  const parts = value.split(':')
  if (parts.length !== 4) {
    return value
  }

  const [, ivB64, authTagB64, ciphertextB64] = parts

  try {
    const iv = Buffer.from(ivB64, 'base64')
    const authTag = Buffer.from(authTagB64, 'base64')
    const ciphertext = Buffer.from(ciphertextB64, 'base64')

    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv)
    decipher.setAuthTag(authTag)
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])

    return plaintext.toString('utf8')
  } catch (error) {
    throw new Error(`[TokenCipher] Failed to decrypt token: ${error instanceof Error ? error.message : String(error)}`)
  }
}
