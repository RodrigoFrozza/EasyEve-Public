'use client'

import { useMemo } from 'react'
import {
  ActivityEnhanced,
  isMiningActivity,
  isAbyssalActivity,
  isExplorationActivity,
  isRattingActivity,
  isSalvagingActivity,
} from '@/types/domain'
import { ExpandableSection, SESSION_SECTION_LABEL } from '../shared/ExpandableSection'
import { SortableItemGrid } from '../shared/SortableItemGrid'
import { Box, PackageOpen } from 'lucide-react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import type { ActivityThemeClasses } from '@/lib/activity/activity-theme'

interface LootManifestSectionProps {
  activity: ActivityEnhanced
  theme?: ActivityThemeClasses
}

export function LootManifestSection({ activity, theme }: LootManifestSectionProps) {
  const { t } = useTranslations()
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
      const runs = (data.runs || []) as Array<{
        lootItems?: Array<{ name: string; typeId?: number; id?: number; quantity: number; value?: number }>
      }>

      if (runs.length > 0) {
        const itemsMap = new Map<string, { name: string; typeId: number; quantity: number; value: number }>()

        const addItem = (item: {
          name: string
          typeId?: number
          id?: number
          quantity: number
          value?: number
        }) => {
          const typeId = item.typeId ?? item.id ?? 0
          const key = `${typeId}:${item.name}`
          const existing = itemsMap.get(key)
          const value = item.value || 0
          if (!existing) {
            itemsMap.set(key, { name: item.name, typeId, quantity: item.quantity, value })
          } else {
            existing.quantity += item.quantity
            existing.value += value
          }
        }

        runs.flatMap((run) => run.lootItems || []).forEach(addItem)
        return Array.from(itemsMap.values())
      }

      return ((data.lootContents || []) as Array<{
        name: string
        typeId: number
        quantity: number
        value?: number
      }>).map((item) => ({
        name: item.name,
        typeId: item.typeId,
        quantity: item.quantity,
        value: item.value || 0,
      }))
    }

    if (isExplorationActivity(activity)) {
      return ((data.lootContents || []) as Array<{ name: string, typeId: number, quantity: number, value?: number }>).map(item => ({
        name: item.name,
        typeId: item.typeId,
        quantity: item.quantity,
        value: item.value || 0
      }))
    }

    if (isSalvagingActivity(activity)) {
      const logs = (data.logs || []) as Array<{
        type?: string
        items?: Array<{ name: string; quantity: number; total?: number; typeId?: number }>
      }>
      const itemsMap = new Map<string, { name: string; typeId: number; quantity: number; value: number }>()

      for (const log of logs) {
        if (log.type !== 'salvage' && log.type !== 'loot-auto') continue
        for (const item of log.items || []) {
          const typeId = item.typeId ?? 0
          const key = `${typeId}:${item.name}`
          const itemValue = item.total ?? 0
          const existing = itemsMap.get(key)
          if (!existing) {
            itemsMap.set(key, { name: item.name, typeId, quantity: item.quantity, value: itemValue })
          } else {
            existing.quantity += item.quantity
            existing.value += itemValue
          }
        }
      }

      return Array.from(itemsMap.values())
    }

    if (isRattingActivity(activity)) {
      const mtuContents = (data.mtuContents || []) as Array<
        Array<{ name: string; quantity: number; typeId?: number; value?: number; totalValue?: number }>
      >
      const salvageContents = (data.salvageContents || []) as Array<
        Array<{ name: string; quantity: number; typeId?: number; value?: number; totalValue?: number }>
      >
      const itemsMap = new Map<string, { name: string; typeId: number; quantity: number; value: number }>()

      const addRattingItem = (item: {
        name: string
        quantity: number
        typeId?: number
        value?: number
        totalValue?: number
      }) => {
        const typeId = item.typeId ?? 0
        const key = `${typeId}:${item.name}`
        const itemValue = item.totalValue ?? item.value ?? 0
        const existing = itemsMap.get(key)
        if (!existing) {
          itemsMap.set(key, { name: item.name, typeId, quantity: item.quantity, value: itemValue })
        } else {
          existing.quantity += item.quantity
          existing.value += itemValue
        }
      }

      mtuContents.flat().forEach(addRattingItem)
      salvageContents.flat().forEach(addRattingItem)

      return Array.from(itemsMap.values())
    }

    return []
  }, [activity])

  const totalValue = lootItems.reduce((sum: number, item) => sum + (item.value || 0), 0)

  if (lootItems.length === 0) return null

  return (
    <ExpandableSection
      title={t('common.session.lootManifest')}
      icon={<PackageOpen className="h-4 w-4" />}
      variant="accent"
      accentClassName={theme?.headerIcon}
      borderClassName={theme ? cn(theme.panel, 'border') : undefined}
      summary={
        <p
          className={cn(
            'font-mono text-[10px] font-black uppercase tracking-[0.2em]',
            SESSION_SECTION_LABEL
          )}
        >
          {formatNumber(lootItems.length)} UNITS · {formatISK(totalValue)}
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
