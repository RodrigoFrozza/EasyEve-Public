/**
 * Activity launch picker access mirrors POST /api/activities:
 * only platform module activation (`ModulePrice.isActive`) gates activity types.
 *
 * Per-user `allowedActivities` is no longer used for launch UI; admins control
 * availability via module toggles. Empty `allowedActivities` is the normal state.
 *
 * @see docs/FINANCIAL_SYSTEM.md
 * @see src/app/api/activities/route.ts
 */
export function canSelectActivityType(isModuleActive: boolean): boolean {
  return isModuleActive
}
