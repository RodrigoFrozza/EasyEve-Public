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
