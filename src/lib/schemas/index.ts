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
  modules: z.array(FitEditorModuleSchema).optional().default([]),
  drones: z.array(FitDroneSchema).optional().default([]),
  cargo: z.array(FitCargoSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  visibility: VisibilitySchema.optional().default("PROTECTED"),
  esiData: z.any().optional().nullable(),
})

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
