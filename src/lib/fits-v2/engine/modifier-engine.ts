import type { AttributeHistory } from '@/types/fit'

export type ModifierPhase = 'preAssign' | 'preMul' | 'mulStack' | 'postMul' | 'postAssign'

export type ModifierInput = {
  attribute: string
  source: string
  phase: ModifierPhase
  type: 'flat' | 'percent' | 'multiplier'
  value: number
  impact: 'positive' | 'negative'
  exemptFromStacking?: boolean
  note?: string
}

export type ProvenanceEntry = {
  source: string
  phase: ModifierPhase
  value: number
  type: 'flat' | 'percent' | 'multiplier'
  impact: 'positive' | 'negative'
  penaltyRank?: number
  effectiveMultiplier?: number
  note?: string
}

const STACKING_PENALTY_CURVE = 2.2229

export function getStackingEfficiency(rank: number): number {
  if (rank <= 1) return 1
  if (rank > 8) return 0
  return Math.exp(-0.5 * Math.pow((rank - 1) / STACKING_PENALTY_CURVE, 2))
}

function toMultiplier(mod: ModifierInput): number {
  if (mod.type === 'percent') return 1 + mod.value / 100
  if (mod.type === 'multiplier') return mod.value
  return 1
}

export function applyModifiersWithProvenance(params: {
  base: number
  attribute: string
  modifiers: ModifierInput[]
  penalizedAttributes: Set<string>
}): {
  final: number
  history: AttributeHistory
  provenance: ProvenanceEntry[]
} {
  const { base, attribute, modifiers, penalizedAttributes } = params
  let value = base
  const provenance: ProvenanceEntry[] = []
  const history: AttributeHistory = {
    base,
    final: base,
    modifiers: [],
  }

  const preAssign = modifiers.filter((m) => m.phase === 'preAssign')
  const preMul = modifiers.filter((m) => m.phase === 'preMul')
  const mulStack = modifiers.filter((m) => m.phase === 'mulStack')
  const postMul = modifiers.filter((m) => m.phase === 'postMul')
  const postAssign = modifiers.filter((m) => m.phase === 'postAssign')

  for (const mod of preAssign) {
    if (mod.type === 'flat') value = mod.value
    history.modifiers.push({
      source: mod.source,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      isExempt: true,
    })
    provenance.push({
      source: mod.source,
      phase: mod.phase,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      note: mod.note,
    })
  }

  for (const mod of preMul) {
    const mult = toMultiplier(mod)
    value *= mult
    history.modifiers.push({
      source: mod.source,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      isExempt: true,
    })
    provenance.push({
      source: mod.source,
      phase: mod.phase,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      effectiveMultiplier: mult,
      note: mod.note,
    })
  }

  const withStrength = mulStack
    .map((mod) => {
      const mult = toMultiplier(mod)
      const strength = Math.abs(Math.log(Math.max(0.0001, mult)))
      return { mod, mult, strength }
    })
    .sort((a, b) => b.strength - a.strength)

  let rank = 1
  for (const item of withStrength) {
    const { mod, mult } = item
    const shouldPenalize = penalizedAttributes.has(attribute) && !mod.exemptFromStacking
    if (!shouldPenalize) {
      value *= mult
      history.modifiers.push({
        source: mod.source,
        value: mod.value,
        type: mod.type,
        impact: mod.impact,
        isExempt: true,
      })
      provenance.push({
        source: mod.source,
        phase: mod.phase,
        value: mod.value,
        type: mod.type,
        impact: mod.impact,
        effectiveMultiplier: mult,
        note: mod.note,
      })
      continue
    }

    const eff = getStackingEfficiency(rank)
    const penalizedMult = 1 + (mult - 1) * eff
    value *= penalizedMult
    history.modifiers.push({
      source: mod.source,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      isExempt: false,
      penaltyRank: rank,
    })
    provenance.push({
      source: mod.source,
      phase: mod.phase,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      penaltyRank: rank,
      effectiveMultiplier: penalizedMult,
      note: mod.note,
    })
    rank++
  }

  for (const mod of postMul) {
    const mult = toMultiplier(mod)
    value *= mult
    history.modifiers.push({
      source: mod.source,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      isExempt: true,
    })
    provenance.push({
      source: mod.source,
      phase: mod.phase,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      effectiveMultiplier: mult,
      note: mod.note,
    })
  }

  for (const mod of postAssign) {
    if (mod.type === 'flat') value = mod.value
    history.modifiers.push({
      source: mod.source,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      isExempt: true,
    })
    provenance.push({
      source: mod.source,
      phase: mod.phase,
      value: mod.value,
      type: mod.type,
      impact: mod.impact,
      note: mod.note,
    })
  }

  history.final = value
  return { final: value, history, provenance }
}
