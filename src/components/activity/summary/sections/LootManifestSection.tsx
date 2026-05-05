'use client'

import { useMemo } from 'react'
import { ActivityEnhanced, isMiningActivity, isAbyssalActivity, isExplorationActivity } from '@/types/domain'
import { ExpandableSection } from '../shared/ExpandableSection'
import { SortableItemGrid } from '../shared/SortableItemGrid'
import { Box, PackageOpen } from 'lucide-react'
import { formatISK, formatNumber, cn } from '@/lib/utils'

interface LootManifestSectionProps {
  activity: ActivityEnhanced
}

export function LootManifestSection({ activity }: LootManifestSectionProps) {
  const lootItems = useMemo(() => {
    const data = activity.data || {}
    
    if (isMiningActivity(activity)) {
      const breakdown = (data.oreBreakdown || {}) as Record<string, { typeId: number, quantity: number, estimatedValue: number }>
      return Object.entries(breakdown).map(([name, entry]) => ({
        name,
        typeId: entry.typeId,
        quantity: entry.quantity,
        value: entry.estimatedValue
      }))
    }

    if (isAbyssalActivity(activity)) {
      // Aggregated loot from session + individual runs
      const sessionLoot = (data.lootContents || []) as Array<{ name: string, typeId: number, quantity: number, value?: number }>
      const itemsMap = new Map<string, { name: string, typeId: number, quantity: number, value: number }>()
      
      sessionLoot.forEach(item => {
        const key = item.name
        const existing = itemsMap.get(key)
        if (!existing) {
          itemsMap.set(key, { ...item, value: item.value || 0 })
        } else {
          existing.quantity += item.quantity
          existing.value = (existing.value || 0) + (item.value || 0)
        }
      })

      return Array.from(itemsMap.values())
    }

    if (isExplorationActivity(activity)) {
      return ((data.lootContents || []) as Array<{ name: string, typeId: number, quantity: number, value?: number }>).map(item => ({
        name: item.name,
        typeId: item.typeId,
        quantity: item.quantity,
        value: item.value || 0
      }))
    }

    return []
  }, [activity])

  const totalValue = lootItems.reduce((sum: number, item) => sum + (item.value || 0), 0)

  if (lootItems.length === 0) return null

  return (
    <ExpandableSection
      title="Loot & Cargo Manifest"
      icon={<PackageOpen className="w-4 h-4" />}
      variant="warning"
      summary={
        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
          {formatNumber(lootItems.length)} unique items · {formatISK(totalValue)}
        </p>
      }
    >
      <div className="py-2">
        <SortableItemGrid 
          items={lootItems} 
          limit={12}
        />
      </div>
    </ExpandableSection>
  )
}
