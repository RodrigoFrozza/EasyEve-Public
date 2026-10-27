/**
 * Shared abyssal deadspace detection (client + server).
 * Abyssal systems: named "Abyssal Deadspace", pattern AD/ID/RD/CD/ND/TD + digits,
 * or solar_system_id in the 32,000,000 range.
 */
export function isInsideAbyss(location: string, solarSystemId = 0): boolean {
  const normalized = location.trim().toLowerCase()
  return (
    normalized.includes('abyssal deadspace') ||
    /^[A-Z]D\d+$/i.test(location.trim()) ||
    (solarSystemId >= 32_000_000 && solarSystemId < 33_000_000)
  )
}
