/**
 * Parse an EVE-formatted numeric string that might use dots as thousand
 * separators, commas as decimal separators (or vice-versa), and trailing
 * units like 'm3' or 'ISK'.
 */
export function parseEveValue(raw: string): number | null {
  if (!raw) return null
  let clean = raw.replace(/[^0-9.,-]/g, '').trim()
  if (!clean) return null

  const dots = (clean.match(/\./g) || []).length
  const commas = (clean.match(/,/g) || []).length

  if (commas === 1 && dots >= 0) {
    // European/Brazilian style: 1.000,00
    clean = clean.replace(/\./g, '').replace(',', '.')
  } else if (dots === 1 && commas === 0) {
    // Could be 1.000 (thousand) or 1.234 (decimal).
    // If it ends in .000 it's 99% a thousand separator in EVE context.
    if (clean.endsWith('.000')) {
      clean = clean.replace(/\./g, '')
    }
  } else if (dots > 1) {
    // Multiple dots: thousand separators
    clean = clean.replace(/\./g, '')
  } else if (commas > 1) {
    // Multiple commas: thousand separators
    clean = clean.replace(/,/g, '')
  }

  const n = parseFloat(clean)
  return isFinite(n) ? n : null
}
