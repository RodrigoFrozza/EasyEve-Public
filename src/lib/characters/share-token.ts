import crypto from 'crypto'

/**
 * Generates an unguessable secret token used as the public shareable Character
 * Profile link (`Character.shareToken`). 16 random bytes (128 bits) is well above
 * brute-force range; base64url keeps it URL-safe without escaping.
 */
export function generateShareToken(): string {
  return crypto.randomBytes(16).toString('base64url')
}
