/**
 * Display metadata for rows in `ModulePrice` (platform module registry).
 * Keys must match the `module` column (typically lowercase slugs).
 */
export const PLATFORM_MODULE_META: Record<
  string,
  { title: string; description: string }
> = {
  fits: {
    title: 'Fits',
    description: 'Ship fitting editor, dogma, and saved loadouts.',
  },
  market: {
    title: 'Market',
    description: 'Market browsing and order-related tools.',
  },
  mining: {
    title: 'Mining',
    description: 'Mining activity tracking and calculators.',
  },
  ratting: {
    title: 'Ratting',
    description: 'Ratting / PvE bounty activity tracking.',
  },
  abyssal: {
    title: 'Abyssal',
    description: 'Abyssal deadspace activity tracking.',
  },
  exploration: {
    title: 'Exploration',
    description: 'Exploration / hacking / relic activity tracking.',
  },
  escalations: {
    title: 'Escalations',
    description: 'Escalation site activity tracking.',
  },
  crab: {
    title: 'CRAB',
    description: 'CRAB / capital-related activity tracking.',
  },
  pvp: {
    title: 'PvP',
    description: 'PvP activity tracking.',
  },
}

export function formatModuleId(moduleId: string): string {
  return moduleId
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export function platformModuleTitle(moduleId: string): string {
  const key = moduleId.toLowerCase()
  return PLATFORM_MODULE_META[key]?.title ?? formatModuleId(moduleId)
}

export function platformModuleDescription(moduleId: string): string {
  const key = moduleId.toLowerCase()
  return (
    PLATFORM_MODULE_META[key]?.description ??
    'When inactive, this area of the product is hidden or blocked for all users.'
  )
}
