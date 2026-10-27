export const MINING_ORE_GROUP_IDS = [18, 19, 20] as const
export const ICE_GROUP_ID = 465 as const
export const ICE_BATCH_SIZE = 1
export const ORE_BATCH_SIZE = 100

/** Matches client auto-sync: keep syncing mining after Finish while ESI ledger catches up. */
export const MINING_POST_COMPLETE_SYNC_MINUTES = 60
