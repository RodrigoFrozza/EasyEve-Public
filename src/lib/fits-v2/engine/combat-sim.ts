import type { ShipStats } from '@/types/fit'

export interface TargetProfile {
  signatureRadius: number
  velocity: number
  angularVelocity: number
  damageProfile?: {
    em: number
    therm: number
    kin: number
    exp: number
  }
}

export interface WeaponApplicationInput {
  optimal: number
  falloff: number
  tracking: number
  rangeToTarget: number
  target: TargetProfile
}

export interface MissileApplicationInput {
  explosionRadius: number
  explosionVelocity: number
  target: TargetProfile
}

export function turretHitChance(input: WeaponApplicationInput): number {
  const { optimal, falloff, tracking, rangeToTarget, target } = input
  const safeTracking = Math.max(0.0001, tracking)
  const safeSig = Math.max(1, target.signatureRadius)
  const safeAngular = Math.max(0, target.angularVelocity)
  const signatureResolution = 40
  const trackingTerm = Math.pow((safeAngular * signatureResolution) / (safeTracking * safeSig), 2)
  const rangeExcess = Math.max(0, rangeToTarget - optimal)
  const rangeTerm = Math.pow(rangeExcess / Math.max(1, falloff), 2)
  const hitChance = Math.pow(0.5, trackingTerm + rangeTerm)
  return Math.max(0, Math.min(1, hitChance))
}

export function missileApplicationFactor(input: MissileApplicationInput): number {
  const { explosionRadius, explosionVelocity, target } = input
  const sigFactor = Math.min(1, target.signatureRadius / Math.max(1, explosionRadius))
  const drf = 0.5
  const rawVelFactor = Math.max(1, explosionVelocity) / Math.max(1, target.velocity)
  const velFactor = Math.min(1, Math.pow(rawVelFactor, drf))
  return Math.max(0, Math.min(1, sigFactor * velFactor))
}

export function simulateCapacitor(params: {
  capacity: number
  rechargeTimeMs: number
  usagePerSecond: number
}): {
  peakDelta: number
  deltaPerSecond: number
  stable: boolean
  percent: number
  timeToEmpty: number
} {
  const { capacity, rechargeTimeMs, usagePerSecond } = params
  const safeCapacity = Math.max(1, capacity)
  const recharge = Math.max(1, rechargeTimeMs)
  const peakDelta = (10 * safeCapacity) / recharge
  const deltaPerSecond = peakDelta - usagePerSecond
  const stable = deltaPerSecond >= 0
  const percent = stable ? 100 : Math.max(0, Math.min(100, (peakDelta / Math.max(0.0001, usagePerSecond)) * 100))
  const timeToEmpty = stable ? Infinity : safeCapacity / Math.max(0.0001, -deltaPerSecond)
  return { peakDelta, deltaPerSecond, stable, percent, timeToEmpty }
}

export function effectiveHitPointsWithProfile(
  stats: ShipStats,
  damageProfile?: { em: number; therm: number; kin: number; exp: number }
): number {
  const profile = damageProfile ?? { em: 0.25, therm: 0.25, kin: 0.25, exp: 0.25 }

  const shieldResist =
    stats.resistance.shield.em * profile.em +
    stats.resistance.shield.therm * profile.therm +
    stats.resistance.shield.kin * profile.kin +
    stats.resistance.shield.exp * profile.exp

  const armorResist =
    stats.resistance.armor.em * profile.em +
    stats.resistance.armor.therm * profile.therm +
    stats.resistance.armor.kin * profile.kin +
    stats.resistance.armor.exp * profile.exp

  const hullResist =
    stats.resistance.hull.em * profile.em +
    stats.resistance.hull.therm * profile.therm +
    stats.resistance.hull.kin * profile.kin +
    stats.resistance.hull.exp * profile.exp

  const shieldEhp = stats.tank.shield.hp / Math.max(0.01, 1 - shieldResist)
  const armorEhp = stats.tank.armor.hp / Math.max(0.01, 1 - armorResist)
  const hullEhp = stats.tank.hull.hp / Math.max(0.01, 1 - hullResist)
  return shieldEhp + armorEhp + hullEhp
}
