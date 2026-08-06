import fs from 'node:fs'
import path from 'node:path'
import {
  missileApplicationFactor,
  simulateCapacitor,
  turretHitChance,
} from '@/lib/fits-v2/engine'

type GoldenCase = {
  id: string
  shipTypeId: number
  target: { signatureRadius: number; velocity: number; angularVelocity: number }
  weapon: { optimal: number; falloff: number; tracking: number; rangeToTarget: number }
  missile: { explosionRadius: number; explosionVelocity: number }
  capacitor: { capacity: number; rechargeTimeMs: number; usagePerSecond: number }
  expected: { turretHitChance: number; missileApplication: number; capStable: boolean }
}

const CASES_DIR = path.join(process.cwd(), 'tests', 'golden-fits')

function loadCases(): GoldenCase[] {
  return fs
    .readdirSync(CASES_DIR)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) =>
      JSON.parse(fs.readFileSync(path.join(CASES_DIR, name), 'utf8')) as GoldenCase
    )
}

describe('golden fit formulas', () => {
  const cases = loadCases()

  test('all golden case files are present', () => {
    expect(cases.length).toBeGreaterThanOrEqual(5)
  })

  test.each(cases)('$id should stay within tolerance', (c) => {
    const turret = turretHitChance({
      optimal: c.weapon.optimal,
      falloff: c.weapon.falloff,
      tracking: c.weapon.tracking,
      rangeToTarget: c.weapon.rangeToTarget,
      target: c.target,
    })
    const missile = missileApplicationFactor({
      explosionRadius: c.missile.explosionRadius,
      explosionVelocity: c.missile.explosionVelocity,
      target: c.target,
    })
    const cap = simulateCapacitor(c.capacitor)

    expect(turret).toBeCloseTo(c.expected.turretHitChance, 3)
    expect(missile).toBeCloseTo(c.expected.missileApplication, 3)
    expect(cap.stable).toBe(c.expected.capStable)
  })
})
