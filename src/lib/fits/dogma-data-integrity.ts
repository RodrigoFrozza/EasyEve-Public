/**
 * Lightweight integrity checks for SDE/ESI-synced rows used by the fitting engine.
 * Missing critical fields should fail closed on authoritative mutations.
 */

export function verifyShipFittingReadiness(ship: {
  typeId?: number
  highSlots?: number | null
  medSlots?: number | null
  lowSlots?: number | null
  rigSlots?: number | null
  subsystemSlots?: number | null
}): string[] {
  const issues: string[] = []
  if (ship.typeId == null || ship.typeId <= 0) {
    issues.push('ship_missing_typeId')
  }
  if (
    ship.highSlots == null &&
    ship.medSlots == null &&
    ship.lowSlots == null &&
    ship.rigSlots == null
  ) {
    issues.push('ship_missing_slot_counts')
  }
  return issues
}

export function verifyModuleReadinessForHardware(mod: {
  typeId: number
  slotType?: string | null
  effects?: unknown
}): string[] {
  const issues: string[] = []
  const hasSlotType = mod.slotType && String(mod.slotType).length > 0
  const hasEffects =
    mod.effects != null &&
    (Array.isArray(mod.effects)
      ? mod.effects.length > 0
      : typeof mod.effects === 'object' &&
        Array.isArray((mod.effects as { effectIds?: number[] }).effectIds) &&
        ((mod.effects as { effectIds?: number[] }).effectIds?.length ?? 0) > 0)
  if (!hasSlotType && !hasEffects) {
    issues.push(`module_${mod.typeId}_missing_slotType_and_effects`)
  }
  return issues
}
