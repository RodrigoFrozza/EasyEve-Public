import { z } from 'zod'

// --- ESI Public Info ---
export const EsiCharacterSchema = z.object({
  character_id: z.number(),
  character_name: z.string(),
  expires_on: z.string().optional(),
  scopes: z.string().optional(),
  token_type: z.string().optional(),
  character_owner_hash: z.string().optional(),
})

export const CharacterPublicInfoSchema = z.object({
  name: z.string(),
  corporation_id: z.number(),
  alliance_id: z.number().optional(),
  security_status: z.number().optional(),
  birthday: z.string(),
  gender: z.string(),
  race_id: z.number(),
  bloodline_id: z.number(),
})

// --- Character Stats ---
export const CharacterSkillsSchema = z.object({
  total_sp: z.number().default(0),
  free_sp: z.number().optional().default(0),
  skills: z.array(z.object({
    skill_id: z.number(),
    skillpoints_in_skill: z.number(),
    trained_skill_level: z.number(),
    active_skill_level: z.number(),
  })).optional().default([]),
  queues: z.array(z.any()).optional().default([]),
})

// ESI does not return a strict ISO 8601 subset here (no fractional seconds
// guarantee), so — matching CharacterPublicInfoSchema.birthday above — these
// are validated as plain strings rather than z.string().datetime() to avoid
// spurious parse failures on a well-formed ESI response.
export const CharacterAttributesSchema = z.object({
  charisma: z.number(),
  intelligence: z.number(),
  memory: z.number(),
  perception: z.number(),
  willpower: z.number(),
  bonus_remaps: z.number().optional(),
  last_remap_date: z.string().optional(),
  accrued_remap_cooldown_date: z.string().optional(),
})

export const CharacterLocationSchema = z.object({
  solar_system_id: z.number(),
  station_id: z.number().optional(),
  structure_id: z.number().optional(),
})

export const CharacterShipSchema = z.object({
  ship_type_id: z.number(),
  ship_item_id: z.number(),
  ship_name: z.string(),
})

// --- Wallet ---
export const WalletTransactionSchema = z.object({
  transaction_id: z.number(),
  date: z.string(),
  type_id: z.number(),
  unit_price: z.number(),
  quantity: z.number(),
  client_id: z.number(),
  is_buy: z.boolean(),
  is_personal: z.boolean(),
  journal_ref_id: z.number(),
  location_id: z.number(),
})

export const WalletJournalSchema = z.object({
  id: z.number(),
  date: z.string(),
  amount: z.number().optional(),
  balance: z.number().optional(),
  description: z.string(),
  ref_type: z.string(),
  reason: z.string().optional(),
  first_party_id: z.number().optional(),
  second_party_id: z.number().optional(),
})

export const TypeDetailsSchema = z.object({
  type_id: z.number(),
  name: z.string(),
  description: z.string(),
  volume: z.number().optional(),
  packaged_volume: z.number().optional(),
  capacity: z.number().optional(),
  portion_size: z.number().optional(),
  mass: z.number().optional(),
  radius: z.number().optional(),
  published: z.boolean().optional(),
  group_id: z.number().optional(),
  market_group_id: z.number().optional(),
  icon_id: z.number().optional(),
  graphic_id: z.number().optional(),
})

// --- Fittings ---
export const VisibilitySchema = z.enum(["PUBLIC", "PROTECTED"])

export const FitModuleSchema = z.object({
  id: z.number(),
  name: z.string(),
  slot: z.enum(["high", "mid", "low", "rig", "subsystem"]).optional(),
  state: z.enum(["active", "passive", "overloaded"]).optional(),
})

export const FitDroneSchema = z.object({
  id: z.number(),
  name: z.string(),
  quantity: z.number(),
})

export const FitCargoSchema = z.object({
  id: z.number(),
  name: z.string(),
  quantity: z.number(),
})

/** Editor / API module row (supports legacy `id` as typeId). */
export const FitEditorModuleSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  typeId: z.number().optional(),
  name: z.string().optional(),
  slot: z.enum(["high", "med", "mid", "low", "rig", "subsystem"]).optional(),
  slotIndex: z.number().optional(),
  offline: z.boolean().optional(),
  charge: z
    .object({ id: z.number(), name: z.string(), quantity: z.number() })
    .optional(),
  chargeTypeId: z.number().optional(),
  groupName: z.string().optional(),
})

export const CreateFittingSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional().nullable(),
  ship: z.string().min(1, "Ship name is required"),
  shipTypeId: z.number().optional().nullable(),
  // Legacy alias. Before AUDIT_REPORT_2026-07-05.md #5.1 was fixed, both fit
  // editors saved local state under the key `shipId` and posted it verbatim,
  // so a browser tab still running that cached bundle after a deploy sends
  // `shipId` instead of `shipTypeId`. Kept here (not persisted itself — see
  // `resolveFitShipTypeId`) so those requests don't silently drop the ship.
  shipId: z.number().optional().nullable(),
  modules: z.array(FitEditorModuleSchema).optional().default([]),
  drones: z.array(FitDroneSchema).optional().default([]),
  cargo: z.array(FitCargoSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  visibility: VisibilitySchema.optional().default("PROTECTED"),
  esiData: z.any().optional().nullable(),
})

/**
 * Resolves the DB column value (`Fit.shipTypeId`) from a validated
 * `CreateFittingSchema` payload, preferring the canonical `shipTypeId` field
 * and falling back to the legacy `shipId` alias. Returns `undefined` when
 * neither is present so callers can `??` it against an existing record
 * without accidentally clearing the ship on a partial (PUT) update.
 */
export function resolveFitShipTypeId(body: {
  shipTypeId?: number | null
  shipId?: number | null
}): number | null | undefined {
  return body.shipTypeId ?? body.shipId ?? undefined
}

const FitMutationCommonSchema = z.object({
  shipTypeId: z.number(),
  modules: z.array(FitEditorModuleSchema),
  drones: z.array(FitDroneSchema).optional().default([]),
  cargo: z.array(FitCargoSchema).optional().default([]),
  characterId: z.number().optional().nullable(),
  skillProfile: z
    .object({
      type: z.enum(["all_5", "character", "none"]),
      skills: z.array(
        z.object({
          id: z.number(),
          level: z.number(),
          name: z.string().optional(),
        })
      ),
      implants: z
        .array(
          z.object({
            typeId: z.number(),
            slot: z.number().optional(),
            name: z.string().optional(),
            bonusTag: z.string().optional(),
            value: z.number().optional(),
          })
        )
        .optional(),
      boosters: z
        .array(
          z.object({
            typeId: z.number(),
            name: z.string().optional(),
            bonusTag: z.string().optional(),
            value: z.number().optional(),
            sideEffectTag: z.string().optional(),
            sideEffectValue: z.number().optional(),
          })
        )
        .optional(),
      fleet: z
        .object({
          warfareLinkStrength: z.number().optional(),
          wingCommandLevel: z.number().optional(),
          fleetCommandLevel: z.number().optional(),
          activeBursts: z.array(z.string()).optional(),
        })
        .nullable()
        .optional(),
    })
    .optional()
    .nullable(),
})

const FitHardwareSlotSchema = z.enum(["high", "med", "low", "rig", "subsystem"])

export const FitMutationSchema = z.discriminatedUnion("action", [
  FitMutationCommonSchema.extend({ action: z.literal("validateOnly") }),
  FitMutationCommonSchema.extend({
    action: z.literal("fitModule"),
    slot: FitHardwareSlotSchema,
    slotIndex: z.number().int().nonnegative(),
    module: z.object({
      typeId: z.number(),
      name: z.string().optional(),
      offline: z.boolean().optional(),
      id: z.string().optional(),
    }),
  }),
  FitMutationCommonSchema.extend({
    action: z.literal("replaceModule"),
    slot: FitHardwareSlotSchema,
    slotIndex: z.number().int().nonnegative(),
    module: z.object({
      typeId: z.number(),
      name: z.string().optional(),
      offline: z.boolean().optional(),
      id: z.string().optional(),
    }),
  }),
  FitMutationCommonSchema.extend({
    action: z.literal("unfitModule"),
    slot: FitHardwareSlotSchema,
    slotIndex: z.number().int().nonnegative(),
  }),
  FitMutationCommonSchema.extend({
    action: z.literal("setCharge"),
    slot: FitHardwareSlotSchema,
    slotIndex: z.number().int().nonnegative(),
    charge: z
      .object({ id: z.number(), name: z.string(), quantity: z.number() })
      .nullable(),
  }),
])

// --- Characters ---
export const LinkCharacterSchema = z.object({
  characterId: z.number(),
  accessToken: z.string(),
  characterOwnerHash: z.string().optional().nullable(),
})

// --- Admin ---
export const AdminUpdateAccountSchema = z.object({
  userId: z.string().min(1, "UserId is required"),
  allowedActivities: z.array(z.string()).optional(),
  subscriptionEnd: z.string().optional().nullable(),
})

export const CreateTesterApplicationSchema = z.object({
  description: z
    .string()
    .trim()
    .min(80, 'Please provide more details about your profile and how you can help.')
    .max(4000, 'Description is too long.'),
  acceptedRules: z.array(z.number().int().min(0)).min(4, 'You must accept all tester rules.'),
})

export const RejectTesterApplicationSchema = z.object({
  reviewNotes: z.string().trim().min(10, 'Please provide a rejection reason.').max(1000),
})

export const ApproveTesterApplicationSchema = z.object({
  reviewNotes: z.string().trim().max(1000).optional(),
})
