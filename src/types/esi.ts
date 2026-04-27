import { z } from 'zod'
import * as schemas from '@/lib/schemas'

// --- Types ---
export type EsiCharacter = z.infer<typeof schemas.EsiCharacterSchema>
export type CharacterPublicInfo = z.infer<typeof schemas.CharacterPublicInfoSchema>
export type CharacterSkills = z.infer<typeof schemas.CharacterSkillsSchema>
export type CharacterLocation = z.infer<typeof schemas.CharacterLocationSchema>
export type CharacterShip = z.infer<typeof schemas.CharacterShipSchema>
export type WalletTransaction = z.infer<typeof schemas.WalletTransactionSchema>
export type WalletJournal = z.infer<typeof schemas.WalletJournalSchema>
export type TypeDetails = z.infer<typeof schemas.TypeDetailsSchema>

// Legacy aliases to support existing code
export type EveCharacter = EsiCharacter
export type EveCharacterLegacy = EsiCharacter

// Re-export schemas for convenience
export const {
  EsiCharacterSchema,
  CharacterPublicInfoSchema,
  CharacterSkillsSchema,
  CharacterLocationSchema,
  CharacterShipSchema,
  WalletTransactionSchema,
  WalletJournalSchema,
  TypeDetailsSchema
} = schemas
