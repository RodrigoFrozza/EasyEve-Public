/**
 * CPU e Powergrid da colônia contra o orçamento do Command Center.
 *
 * Porte de `pi-grid.ts`. Todos os números vêm dos atributos dogma da ESI — nada
 * é estimado. O que NÃO entra são os links: a ESI não expõe o custo por link e
 * ele depende de uma fórmula interna de distância. Por isso `excludesLinks` é
 * parte do tipo e não um comentário — a UI é obrigada a rotular que o número é
 * um piso, não a utilização real.
 */

import type { PiColonyLayout } from '@/lib/pi-v2/esi'
import {
  ccGridBudget,
  extractorHeadCost,
  pinGridLoad,
  pinRole,
  type PiGridCost,
  type PiPinRole,
} from '@/lib/pi-v2/sde'

export interface GridRoleBreakdown {
  role: PiPinRole
  count: number
  power: number
  cpu: number
}

export interface GridUsage {
  power: { used: number; total: number; utilization: number }
  cpu: { used: number; total: number; utilization: number }
  /** A restrição que aperta primeiro — a maior das duas utilizações. */
  utilization: number
  binding: 'power' | 'cpu'
  /** Carga acima do orçamento (não deveria acontecer numa colônia válida). */
  overCapacity: boolean
  /** Custo dos links não incluído: a utilização real é algo maior. */
  excludesLinks: true
  breakdown: GridRoleBreakdown[]
}

function ratio(used: number, total: number): number {
  return total > 0 ? used / total : 0
}

/** Ordem estável e legível do detalhamento (da entrada da cadeia para a saída). */
const ROLE_ORDER: PiPinRole[] = [
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

export function computeColonyGrid(layout: PiColonyLayout, upgradeLevel: number): GridUsage {
  const budget = ccGridBudget(upgradeLevel)

  const byRole = new Map<PiPinRole, GridRoleBreakdown>()
  let usedPower = 0
  let usedCpu = 0

  for (const pin of layout.pins) {
    const role = pinRole(pin.type_id)
    const base = pinGridLoad(pin.type_id)
    let power = base.power
    let cpu = base.cpu

    // Cada cabeça do extrator custa grid além da estrutura em si.
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

  return {
    power: { used: usedPower, total: budget.power, utilization: powerUtil },
    cpu: { used: usedCpu, total: budget.cpu, utilization: cpuUtil },
    utilization: Math.max(powerUtil, cpuUtil),
    binding: cpuUtil >= powerUtil ? 'cpu' : 'power',
    overCapacity: usedPower > budget.power || usedCpu > budget.cpu,
    excludesLinks: true,
    breakdown: ROLE_ORDER.map((r) => byRole.get(r)).filter(
      (b): b is GridRoleBreakdown => b != null && (b.power > 0 || b.cpu > 0)
    ),
  }
}

/** Quantas cópias de uma estrutura ainda cabem no orçamento restante. */
export function gridHeadroomFor(usage: GridUsage, cost: PiGridCost): number {
  const byPower = cost.power > 0 ? Math.floor((usage.power.total - usage.power.used) / cost.power) : Infinity
  const byCpu = cost.cpu > 0 ? Math.floor((usage.cpu.total - usage.cpu.used) / cost.cpu) : Infinity
  return Math.max(0, Math.min(byPower, byCpu))
}
