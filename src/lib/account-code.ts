export function generateAccountCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'EVE-'
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export function validateAccountCode(code: string): boolean {
  return /^EVE-[A-HJ-NP-Z2-9]{6}$/.test(code)
}

/**
 * Extracts a canonical (uppercased) account code from one or more free-text
 * sources, scanning them in order and returning the first match.
 *
 * EVE's wallet journal exposes the payer's typed note in the `reason` field,
 * while `description` holds CCP's auto-generated text (e.g. "[r] X deposited
 * cash into ..."). Payments must therefore be matched against `reason` first —
 * scanning only `description` misses every code a player actually typed.
 */
export function extractAccountCode(...sources: Array<string | null | undefined>): string | null {
  for (const source of sources) {
    const match = source?.match(/EVE-[A-HJ-NP-Z2-9]{6}/i)
    if (match) return match[0].toUpperCase()
  }
  return null
}
