export type SlotType = 'high' | 'med' | 'low' | 'rig' | 'subsystem'

export interface MarketGroup {
  id: number
  name: string
  description?: string
  parentId: number | null
  children: MarketGroup[]
  modules: ModuleInfo[]
}

export interface ModuleInfo {
  typeId: number
  id?: string
  name: string
  groupId: number
  groupName: string
  categoryName?: string
  slotType: SlotType | string
  marketGroupId?: number
  marketGroupName?: string
  cpu?: number
  powerGrid?: number
  metaLevel?: number
  metaGroupName?: string
  metaGroupId?: number
  rigSize?: number
  chargeSize?: number
  isDrone?: boolean
  isCharge?: boolean
}

const META_GROUP_COLORS: Record<string, string> = {
  'Officer': 'text-orange-400',
  'Deadspace': 'text-purple-400',
  'Faction': 'text-cyan-400',
  'Storyline': 'text-green-400',
  'Tech II': 'text-yellow-400',
  'Tech III': 'text-blue-400',
  'Tech I': 'text-zinc-400',
  'Standard': 'text-zinc-500',
}

export function getMetaGroupDisplay(metaGroupName?: string, metaLevel?: number): { label: string; color: string } {
  if (!metaGroupName) {
    if (metaLevel === 1) return { label: 'T1', color: 'text-zinc-500' }
    if (metaLevel === 2) return { label: 'T2', color: 'text-yellow-400' }
    if (metaLevel === 3) return { label: 'T3', color: 'text-blue-400' }
    return { label: '', color: 'text-zinc-600' }
  }
  
  if (metaGroupName.includes('Officer')) return { label: 'OFF', color: 'text-orange-400' }
  if (metaGroupName.includes('Deadspace')) return { label: 'DS', color: 'text-purple-400' }
  if (metaGroupName.includes('Faction')) return { label: 'FAC', color: 'text-cyan-400' }
  if (metaGroupName.includes('Storyline')) return { label: 'STY', color: 'text-green-400' }
  if (metaGroupName.includes('Tech II')) return { label: 'T2', color: 'text-yellow-400' }
  if (metaGroupName.includes('Tech III')) return { label: 'T3', color: 'text-blue-400' }
  return { label: '', color: 'text-zinc-600' }
}

export interface ModuleCompatibility {
  typeId: number
  canFitShipGroups: number[]
  canFitShipTypes: number[]
  requiredSkills: { id: number; level: number }[]
  rigSize?: number
}

export interface ShipSlotInfo {
  high: number
  med: number
  low: number
  rig: number
  subsystem?: number
}
