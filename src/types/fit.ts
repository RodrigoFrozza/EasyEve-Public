export type Visibility = 'PUBLIC' | 'PROTECTED'

export interface Module {
  id?: string
  typeId: number
  name?: string
  groupName?: string
  slot?: 'high' | 'med' | 'low' | 'rig' | 'subsystem' | 'service' | 'drone'
  slotIndex?: number
  chargeTypeId?: number
  charge?: {
    id: number
    name: string
    quantity: number
  }
  state?: 'active' | 'passive' | 'overloaded'
  offline?: boolean
  quantity?: number
}

export interface Drone {
  id: number
  name: string
  quantity: number
}

export interface Fighter {
  id: number
  name: string
  quantity: number
}

export interface CargoItem {
  id: number
  name: string
  quantity: number
}

export interface Modifier {
  source: string
  value: number
  type: 'flat' | 'percent' | 'multiplier'
  impact: 'positive' | 'negative'
  isExempt?: boolean
  penaltyRank?: number
}

export interface AttributeHistory {
  base: number
  final: number
  modifiers: Modifier[]
}

export interface Skill {
  id: number
  level: number
  name?: string
}

export type SkillProfileType = 'all_5' | 'character' | 'none'

export interface SkillProfile {
  type: SkillProfileType
  skills: Skill[]
  implants?: ImplantProfile[]
  boosters?: BoosterProfile[]
  fleet?: FleetProfile | null
}

export interface ImplantProfile {
  typeId: number
  slot?: number
  name?: string
  bonusTag?: string
  value?: number
}

export interface BoosterProfile {
  typeId: number
  name?: string
  bonusTag?: string
  value?: number
  sideEffectTag?: string
  sideEffectValue?: number
}

export interface FleetProfile {
  warfareLinkStrength?: number
  wingCommandLevel?: number
  fleetCommandLevel?: number
  activeBursts?: string[]
}

export interface FitSlot {
  high: Module[]
  med: Module[]
  low: Module[]
  rig: Module[]
  subsystem?: Module[]
  drone?: Module[]
  cargo?: Module[]
}

export interface ShipStats {
  groupId: number
  rigSize?: number
  contractVersion?: number
  cpu: {
    total: number
    used: number
    remaining: number
    percent: number
    overflow: boolean
  }
  power: {
    total: number
    used: number
    remaining: number
    percent: number
    overflow: boolean
  }
  powergrid: { // Legacy alias for power
    total: number
    used: number
    remaining: number
    percent: number
  }
  calibration: {
    total: number
    used: number
    remaining: number
    percent: number
    overflow: boolean
  }
  slots: {
    high: { used: number; total: number; overflow: boolean }
    med: { used: number; total: number; overflow: boolean }
    low: { used: number; total: number; overflow: boolean }
    rig: { used: number; total: number; overflow: boolean }
    service?: { used: number; total: number; overflow: boolean }
    drone?: { used: number; total: number; overflow: boolean }
  }
  hardpoints: {
    turrets: { used: number; total: number; overflow: boolean }
    launchers: { used: number; total: number; overflow: boolean }
  }
  tank: {
    shield: { hp: number; regen: number; maxRegen: number }
    armor: { hp: number; repair: number }
    hull: { hp: number; repair: number }
  }
  resistance: {
    shield: { em: number; therm: number; kin: number; exp: number }
    armor: { em: number; therm: number; kin: number; exp: number }
    hull: { em: number; therm: number; kin: number; exp: number }
  }
  ehp: { shield: number; armor: number; hull: number; total: number }
  mass: number
  agility: number
  capacitor: {
    capacity: number
    rechargeRate: number
    peakDelta: number
    stable: boolean
    percent: number
    usePerSecond: number
    deltaPerSecond: number
    timeToEmpty: number
  }
  dps: {
    total: number
    turret: number
    missile: number
    drone: number
  }
  volley: {
    total: number
  }
  range: {
    optimal: number
    falloff: number
  }
  targeting: {
    maxTargets: number
    range: number
    scanRes: number
    sensorStrength: number
    signature: number
  }
  velocity: {
    maxSpeed: number
    alignTime: number
    warpSpeed: number
  }
  slotHistory: {
    [slotKey: string]: {
      [attribute: string]: AttributeHistory
    }
  }
  history: {
    [attribute: string]: AttributeHistory
  }
  provenance?: {
    [attribute: string]: Array<{
      source: string
      phase: 'preAssign' | 'preMul' | 'mulStack' | 'postMul' | 'postAssign'
      value: number
      type: 'flat' | 'percent' | 'multiplier'
      impact: 'positive' | 'negative'
      penaltyRank?: number
      effectiveMultiplier?: number
      note?: string
    }>
  }
  cost: number
  validation: Validation
}

export interface Validation {
  canFit: boolean
  warnings: string[]
  /** Internal: typeIds already surfaced for module catalog quality warnings (deduped). */
  moduleDataQualityWarnedTypeIds?: number[]
  errors: string[]
  slotErrors: Record<string, string[]>
  powergridOverflow: boolean
  cpuOverflow: boolean
  calibrationOverflow: boolean
  slotsOverflow: {
    high: boolean
    med: boolean
    low: boolean
    rig: boolean
    subsystem: boolean
  }
}

export interface Fit {
  id: string
  userId: string
  name: string
  description?: string | null
  ship: string
  shipId: number
  rigSize?: number
  modules: Module[]
  drones: Drone[]
  fighters: Fighter[]
  cargo: CargoItem[]
  tags: string[]
  visibility: Visibility
  esiData?: ShipStats | null
  createdAt: Date
  updatedAt: Date
}

export type FitCreateInput = Omit<Fit, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'esiData'>
export type FitUpdateInput = Partial<FitCreateInput>
