export type RuleRejection = {
  ruleId: string
  message: string
  slotKey?: string
}

export function inferRuleIdFromMessage(message: string): string {
  const msg = message.toLowerCase()
  if (msg.includes('ship_data_incomplete')) return 'ship_data_incomplete'
  if (msg.includes('not_in_database')) return 'module_not_in_database'
  if (msg.includes('cannot be fitted on this ship group')) return 'ship_group_restriction'
  if (msg.includes('restricted to specific ship types')) return 'ship_type_restriction'
  if (msg.includes('requires a') && msg.includes('slot')) return 'slot_type_mismatch'
  if (msg.includes('invalid slot')) return 'invalid_slot_assignment'
  if (msg.includes('charge type') && msg.includes('not found')) return 'charge_not_found'
  if (msg.includes('not allowed in module') || msg.includes('not compatible with module'))
    return 'charge_group_mismatch'
  if (msg.includes('charge size mismatch')) return 'charge_size_mismatch'
  if (msg.includes('turret hardpoints')) return 'turret_hardpoint_overflow'
  if (msg.includes('launcher hardpoints')) return 'launcher_hardpoint_overflow'
  if (msg.includes('cpu overflow')) return 'cpu_overflow'
  if (msg.includes('powergrid overflow')) return 'powergrid_overflow'
  if (msg.includes('only') && msg.includes('allowed per ship')) return 'max_group_active'
  if (msg.includes('strategic cruisers require exactly 4 subsystems')) return 'subsystem_completeness'
  if (msg.includes('calibration overflow')) return 'calibration_overflow'
  if (msg.includes('drone and must be placed in the drone bay')) return 'drone_slot_violation'
  if (msg.includes('charge and cannot be fitted directly')) return 'charge_slot_violation'
  return 'validation_rule_unknown'
}

export function extractRuleRejections(
  errors: string[],
  slotErrors: Record<string, string[]>
): RuleRejection[] {
  const rejections: RuleRejection[] = []
  const seen = new Set<string>()
  for (const [slotKey, messages] of Object.entries(slotErrors || {})) {
    for (const message of messages || []) {
      const ruleId = inferRuleIdFromMessage(message)
      const id = `${slotKey}|${ruleId}|${message}`
      if (seen.has(id)) continue
      seen.add(id)
      rejections.push({ slotKey, ruleId, message })
    }
  }
  for (const message of errors || []) {
    const ruleId = inferRuleIdFromMessage(message)
    const id = `|${ruleId}|${message}`
    if (seen.has(id)) continue
    seen.add(id)
    rejections.push({ ruleId, message })
  }
  return rejections
}
