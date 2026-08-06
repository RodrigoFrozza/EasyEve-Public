import type { Module, Drone, CargoItem, ShipStats } from '@/types/fit'
import type { FitsV2Code } from '@/lib/fits-v2/errors-v2'

/** Authoritative hardware snapshot returned by v2 endpoints. */
export interface FitsV2State {
  shipTypeId: number
  modules: Module[]
  drones: Drone[]
  cargo: CargoItem[]
}

/** Standard JSON envelope for `/api/fits/v2/*`. */
export interface FitsV2Response {
  success: boolean
  code: FitsV2Code | string
  state: FitsV2State
  stats: ShipStats | null
  errors: string[]
  slotErrors: Record<string, string[]>
}

/** Optional metadata for EFT import flows. */
export interface FitsV2ResolveMeta {
  name?: string
  ship?: string
  shipId?: number
}

export type FitsV2ResolveResponse = FitsV2Response & FitsV2ResolveMeta
