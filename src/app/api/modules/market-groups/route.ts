import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { inferModuleSlotTypeFromEffects } from '@/lib/dogma-calculator'
import { 
  MARKET_GROUP_STRUCTURE, 
  GROUP_TO_MARKET_GROUP, 
  GENERIC_GROUP_SPLITS, 
  NO_TIER_SUBFOLDERS, 
  META_GROUP_ORDER 
} from '@/lib/constants/market-group-mappings'

export const dynamic = 'force-dynamic'

interface MarketGroupNode {
  id: number
  name: string
  description?: string
  parentId: number | null
  children: MarketGroupNode[]
  modules: ModuleItem[]
}

interface ModuleItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  slotType: string
  categoryId?: number
  cpu?: number
  powerGrid?: number
  metaLevel?: number
  metaGroupName?: string
  chargeSize?: number
  isDrone?: boolean
  isCharge?: boolean
  isTurret?: boolean
  isLauncher?: boolean
  restrictions?: {
    allowedGroups: number[]
    allowedTypes: number[]
  }
}

function splitGenericGroup(mod: ModuleItem, currentMarketGroupId: number): number {
  const splits = GENERIC_GROUP_SPLITS[currentMarketGroupId]
  if (!splits) return currentMarketGroupId

  const modName = mod.name || ''
  
  // Check more specific keywords first (ordered in the array)
  for (const split of splits) {
    if (split.keywords.some(kw => modName.toLowerCase().includes(kw.toLowerCase()))) {
      return split.targetId
    }
  }

  return currentMarketGroupId
}

function hasModules(node: MarketGroupNode): boolean {
  if (node.modules.length > 0) return true
  return node.children.some(child => hasModules(child))
}

function getMetaCategory(metaGroupName: string | undefined, metaLevel: number | undefined | null): string {
  if (!metaGroupName) {
    if (metaLevel === 0 || metaLevel === 1) return 'Tech I'
    if (metaLevel === 2) return 'Tech II'
    if (metaLevel === 3) return 'Tech III'
    return 'Standard'
  }
  
  const lowerName = metaGroupName.toLowerCase()
  if (lowerName.includes('officer')) return 'Officer'
  if (lowerName.includes('deadspace')) return 'Deadspace'
  if (lowerName.includes('faction')) {
    if (lowerName.includes('structure')) return 'Structure Faction'
    return 'Faction'
  }
  if (lowerName.includes('storyline')) return 'Storyline'
  if (lowerName.includes('abyssal')) return 'Abyssal'
  if (lowerName.includes('limited time')) return 'Limited Time'
  if (lowerName.includes('premium')) return 'Premium'
  if (lowerName.includes('structure')) {
    if (lowerName.includes('tech ii')) return 'Structure Tech II'
    return 'Structure Tech I'
  }
  if (lowerName.includes('tech ii')) return 'Tech II'
  if (lowerName.includes('tech iii')) return 'Tech III'
  if (lowerName.includes('tech i')) return 'Tech I'
  
  return 'Standard'
}

function buildTree(modules: ModuleItem[]): MarketGroupNode[] {
  const nodes: Record<number, MarketGroupNode> = {}
  
  for (const [id, group] of Object.entries(MARKET_GROUP_STRUCTURE)) {
    nodes[parseInt(id)] = {
      id: parseInt(id),
      name: group.name,
      description: group.description,
      parentId: group.parentId,
      children: [],
      modules: []
    }
  }

  for (const mod of modules) {
    let marketGroupId = GROUP_TO_MARKET_GROUP[mod.groupId]

    if (mod.isDrone) {
      mod.slotType = 'drone'
    }

    // Apply heuristic splitting for generic groups
    if (marketGroupId) {
      marketGroupId = splitGenericGroup(mod, marketGroupId)
    }
    
    // Skip ammo/charges (Category 8 is already filtered in SQL, but we keep this as double safety)
    const chargeGroupIds = [
      83, 112, 113, 114, 115, 116, 117, 157, 158, 159, 160, 161, 162, 163,
      1194, 1195, 1196, 1197, 1198, 1199, 1200,
      198, 199, 200, 201, 202, 203, 204, 205, 206, 207,
      231, 232, 233, 234, 235, 236,
    ]
    if (chargeGroupIds.includes(mod.groupId)) continue
    
    if (mod.groupName && (mod.groupName.toLowerCase().includes('ammo') || mod.groupName.toLowerCase().includes('charge'))) {
      continue
    }

    // Skip blueprints
    if (mod.name && (mod.name.toLowerCase().includes('blueprint') || mod.name.toLowerCase().includes(' bpc') || mod.name.toLowerCase().includes(' bpo'))) {
      continue
    }

    // Smart Fallback: If not mapped, use slotType to categorize
    if (!marketGroupId) {
      const slot = (mod.slotType || '').toLowerCase()
      if (slot === 'high') marketGroupId = 1000
      else if (slot === 'med') marketGroupId = 1001
      else if (slot === 'low') marketGroupId = 1002
      else if (slot === 'rig') marketGroupId = 1111
      else marketGroupId = 999
    }
    
    const metaCategory = getMetaCategory(mod.metaGroupName, mod.metaLevel)
    const skipTiers = NO_TIER_SUBFOLDERS.includes(marketGroupId)
    
    if (nodes[marketGroupId]) {
      if (skipTiers) {
        nodes[marketGroupId].modules.push(mod)
      } else {
        // Find or create tier subcategory
        const tierNode = nodes[marketGroupId].children.find(c => c.name === metaCategory)
        if (tierNode) {
          tierNode.modules.push(mod)
        } else {
          const newTierId = -(parseInt(`${Math.abs(marketGroupId)}${Object.keys(META_GROUP_ORDER).indexOf(metaCategory)}`))
          nodes[marketGroupId].children.push({
            id: newTierId,
            name: metaCategory,
            parentId: marketGroupId,
            children: [],
            modules: [mod]
          })
        }
      }
    }
  }

  const roots: MarketGroupNode[] = []
  for (const node of Object.values(nodes)) {
    if (node.parentId === null) {
      roots.push(node)
    } else if (nodes[node.parentId]) {
      nodes[node.parentId].children.push(node)
    }
  }

  function filterAndSort(node: MarketGroupNode): MarketGroupNode | null {
    // 1. Process children first
    node.children = node.children
      .map(child => filterAndSort(child))
      .filter((child): child is MarketGroupNode => child !== null)
    
    // 2. Filter out empty nodes
    if (!hasModules(node)) return null
    
    // 3. Sort children alphabetically
    node.children.sort((a, b) => a.name.localeCompare(b.name))
    
    // 4. Sort modules by meta group order then name
    node.modules.sort((a, b) => {
      const orderA = META_GROUP_ORDER[getMetaCategory(a.metaGroupName, a.metaLevel)] || 99
      const orderB = META_GROUP_ORDER[getMetaCategory(b.metaGroupName, b.metaLevel)] || 99
      if (orderA !== orderB) return orderA - orderB
      return a.name.localeCompare(b.name)
    })
    
    return node
  }

  return roots
    .map(root => filterAndSort(root))
    .filter((root): root is MarketGroupNode => root !== null)
    .sort((a, b) => a.name.localeCompare(b.name))
}

export const GET = withErrorHandling(async () => {
  const rawModules = await prisma.$queryRaw<any[]>`
    SELECT 
      "typeId",
      "name",
      "groupId",
      "groupName",
      "categoryId",
      COALESCE("slotType", '') as "slotType",
      COALESCE("cpu", 0) as "cpu",
      COALESCE("powerGrid", 0) as "powerGrid",
      "metaLevel",
      "metaGroupName",
      "chargeSize",
      "effects",
      "restrictions"
    FROM "ModuleStats"
    ORDER BY "name" ASC
  `

  const modules = rawModules
    .map((m) => {
    const effects = (m.effects as Record<string, any>) || {}
      const derivedSlot = inferModuleSlotTypeFromEffects({
        effects,
        slotType: m.slotType || null,
      })
      const categoryId = Number(m.categoryId || 0)
      const isDrone = categoryId === 18
      const isCharge = categoryId === 8
      const normalizedSlot = isDrone ? 'drone' : derivedSlot || (m.slotType === 'mid' ? 'med' : m.slotType)

      return {
        ...m,
        categoryId,
        slotType: normalizedSlot || '',
        isTurret: effects.isTurret || false,
        isLauncher: effects.isLauncher || false,
        isDrone,
        isCharge,
        restrictions: (m.restrictions as any) || { allowedGroups: [], allowedTypes: [] }
      }
    })
    .filter((m) => {
      // Keep only fittable rack modules and drones in browser catalog.
      if (m.categoryId === 18) return true
      if (m.categoryId !== 7) return false
      return ['high', 'med', 'low', 'rig', 'subsystem'].includes((m.slotType || '').toLowerCase())
    }) as ModuleItem[]

  const tree = buildTree(modules)
  return NextResponse.json(tree)
})
