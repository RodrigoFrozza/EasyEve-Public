import type { PiColonyLayout } from '@/lib/pi/types'
import type { PiPinRole } from '@/lib/pi/pi-static-data'
import { getPinRole } from '@/lib/pi/pi-static-data'
import {
  ccGridBudget,
  pinGridLoad,
  extractorHeadCost,
  type PiGridCost,
} from '@/lib/pi/pi-grid-data'

export interface PiGridRoleBreakdown {
  role: PiPinRole
  count: number
  power: number
  cpu: number
}

export interface PiGridUsage {
  power: { used: number; total: number; utilization: number }
  cpu: { used: number; total: number; utilization: number }
  /** The binding constraint — the higher of the two utilization ratios (0..1+). */
  utilization: number
  binding: 'power' | 'cpu'
  /** True if load exceeds budget (should not happen for a validly built colony). */
  overCapacity: boolean
  /**
   * Link CPU/PG costs are NOT included — ESI does not expose per-link grid cost
   * and it depends on an internal distance formula. Usage here is therefore a
   * lower bound (real utilization is somewhat higher on link-heavy colonies).
   */
  excludesLinks: true
  breakdown: PiGridRoleBreakdown[]
}

function ratio(used: number, total: number): number {
  if (total <= 0) return 0
  return used / total
}

/**
 * Compute CPU / Powergrid utilization for a colony from real ESI dogma loads.
 * Pure and synchronous — all figures come from pi-grid-data (ESI-sourced).
 * Excludes link costs (see PiGridUsage.excludesLinks).
 */
export function computeColonyGrid(
  layout: PiColonyLayout,
  upgradeLevel: number
): PiGridUsage {
  const budget = ccGridBudget(upgradeLevel)

  const byRole = new Map<PiPinRole, PiGridRoleBreakdown>()
  let usedPower = 0
  let usedCpu = 0

  for (const pin of layout.pins) {
    const role = getPinRole(pin.type_id)
    const base = pinGridLoad(pin.type_id)
    let power = base.power
    let cpu = base.cpu

    if (role === 'extractor') {
      const heads = pin.extractor_details?.heads?.length ?? 0
      const head = extractorHeadCost(pin.type_id)
      power += heads * head.power
      cpu += heads * head.cpu
    }

    usedPower += power
    usedCpu += cpu

    const acc = byRole.get(role) ?? { role, count: 0, power: 0, cpu: 0 }
    acc.count += 1
    acc.power += power
    acc.cpu += cpu
    byRole.set(role, acc)
  }

  const powerUtil = ratio(usedPower, budget.power)
  const cpuUtil = ratio(usedCpu, budget.cpu)
  const binding: 'power' | 'cpu' = cpuUtil >= powerUtil ? 'cpu' : 'power'

  // Stable, readable order for the breakdown.
  const roleOrder: PiPinRole[] = [
    'command_center',
    'extractor',
    'basic_processor',
    'advanced_processor',
    'high_tech_processor',
    'storage',
    'launchpad',
    'link',
    'unknown',
  ]
  const breakdown = roleOrder
    .map((r) => byRole.get(r))
    .filter((b): b is PiGridRoleBreakdown => b != null && (b.power > 0 || b.cpu > 0))

  return {
    power: { used: usedPower, total: budget.power, utilization: powerUtil },
    cpu: { used: usedCpu, total: budget.cpu, utilization: cpuUtil },
    utilization: Math.max(powerUtil, cpuUtil),
    binding,
    overCapacity: usedPower > budget.power || usedCpu > budget.cpu,
    excludesLinks: true,
    breakdown,
  }
}

/**
 * How many more copies of a structure (given its grid cost) fit in the remaining
 * budget — limited by the tighter of power/CPU. Used for headroom hints.
 */
export function gridHeadroomFor(usage: PiGridUsage, cost: PiGridCost): number {
  const remPower = usage.power.total - usage.power.used
  const remCpu = usage.cpu.total - usage.cpu.used
  const byPower = cost.power > 0 ? Math.floor(remPower / cost.power) : Infinity
  const byCpu = cost.cpu > 0 ? Math.floor(remCpu / cost.cpu) : Infinity
  return Math.max(0, Math.min(byPower, byCpu))
}
