import { z } from 'zod'

export const launchActivityTypeSchema = z.enum(['mining', 'ratting', 'abyssal', 'exploration'])

export const launchParticipantSchema = z.object({
  characterId: z.number(),
  characterName: z.string().optional(),
  fit: z.string().optional(),
  fitName: z.string().optional(),
  shipTypeId: z.number().optional(),
}).passthrough()

export type LaunchActivityType = z.infer<typeof launchActivityTypeSchema>
export type LaunchParticipant = z.infer<typeof launchParticipantSchema>

const nonEmptyString = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)

export const miningActivityDataSchema = z.object({
  miningType: nonEmptyString(120),
})

export const rattingActivityDataSchema = z.object({
  npcFaction: nonEmptyString(120).optional(),
  siteType: nonEmptyString(120).optional(),
  siteName: nonEmptyString(180),
  autoLootTrackingEnabled: z.boolean().optional(),
  autoLootCharacterId: z.number().optional(),
  autoLootStructureId: z.number().optional(),
  autoLootStructureName: z.string().optional(),
  autoLootContainerId: z.number().optional(),
  autoLootContainerName: z.string().optional(),
})

export const abyssalActivityDataSchema = z.object({
  lastCargoState: nonEmptyString(20000),
  abyssalTier: nonEmptyString(80).optional(),
  abyssalWeather: nonEmptyString(80).optional(),
})

export const explorationActivityDataSchema = z.object({
  lastCargoState: nonEmptyString(20000),
  siteType: nonEmptyString(120).optional(),
  region: nonEmptyString(180).optional(),
})

export type ActivityLaunchValidationResult = {
  isValid: boolean
  issues: string[]
}

type LaunchInput = {
  type?: string
  participants?: Array<{ characterId?: number }>
  space?: string
  region?: string
  data?: Record<string, unknown>
}

function checkAutoLootRules(data: z.infer<typeof rattingActivityDataSchema>, issues: string[]) {
  if (!data.autoLootTrackingEnabled) return
  if (!data.autoLootCharacterId) issues.push('Container owner is required when auto loot tracking is enabled')
  if (!data.autoLootContainerId) issues.push('Container is required when auto loot tracking is enabled')
  if (!data.autoLootContainerName?.trim()) issues.push('Container name is required when auto loot tracking is enabled')
}

export function validateLaunchActivityInput(input: LaunchInput): ActivityLaunchValidationResult {
  const issues: string[] = []

  const typeResult = launchActivityTypeSchema.safeParse(input.type)
  if (!typeResult.success) {
    issues.push('Activity type must be mining, ratting, abyssal, or exploration')
  }

  const participants = Array.isArray(input.participants) ? input.participants : []
  if (participants.length === 0) {
    issues.push('At least one participant is required')
  }

  if (issues.length > 0 || !typeResult.success) {
    return { isValid: false, issues }
  }

  const type = typeResult.data
  const data = input.data ?? {}

  if (type === 'mining') {
    if (!input.space?.trim()) issues.push('Security level / space is required for mining')
    const miningResult = miningActivityDataSchema.safeParse(data)
    if (!miningResult.success) issues.push('Mining category is required for mining activities')
  }

  if (type === 'ratting') {
    if (!input.space?.trim()) issues.push('Security level / space is required for ratting')
    const rattingResult = rattingActivityDataSchema.safeParse(data)
    if (!rattingResult.success) {
      issues.push('Detected anomaly is required for ratting activities')
    } else if (input.space !== 'Wormhole' && input.space !== 'Pochven' && !rattingResult.data.npcFaction?.trim()) {
      issues.push('Hostile faction is required for this ratting space')
    } else {
      checkAutoLootRules(rattingResult.data, issues)
    }
  }

  if (type === 'abyssal') {
    const abyssalResult = abyssalActivityDataSchema.safeParse(data)
    if (!abyssalResult.success) {
      issues.push('Initial cargo state is required for abyssal activities')
    }
  }

  if (type === 'exploration') {
    if (!input.region?.trim()) issues.push('Region is required for exploration')
    const explorationResult = explorationActivityDataSchema.safeParse({
      ...data,
      region: data.region ?? input.region,
    })
    if (!explorationResult.success) {
      issues.push('Initial cargo state is required for exploration activities')
    }
  }

  return { isValid: issues.length === 0, issues }
}
