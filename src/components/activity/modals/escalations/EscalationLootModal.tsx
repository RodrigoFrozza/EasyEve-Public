'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EscalationsThemedDialog } from './EscalationsThemedDialog'
import { useTranslations } from '@/i18n/hooks'
import { formatISK, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  setEscalationLoot,
  type EscalationEntry,
  type EscalationsActivityData,
} from '@/lib/activities/escalations-entries'
import { parseEVECargoEntries } from '@/lib/parsers/eve-cargo-parser'
import { getMarketAppraisalDetailed } from '@/lib/market'

interface EscalationLootModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: {
    id: string
    data?: Record<string, unknown>
  }
  escalation: EscalationEntry | null
  onRefresh?: () => void
}

function parseIskInput(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) && num >= 0 ? num : 0
}

export function EscalationLootModal({
  open,
  onOpenChange,
  activity,
  escalation,
  onRefresh,
}: EscalationLootModalProps) {
  const { t } = useTranslations()
  const data = (activity.data || {}) as EscalationsActivityData
  const lastCargoState = data.lastCargoState || ''

  const [tab, setTab] = useState<'manual' | 'cargo'>('manual')
  const [manualValue, setManualValue] = useState('')
  const [beforeText, setBeforeText] = useState('')
  const [afterText, setAfterText] = useState('')
  const [previewTotal, setPreviewTotal] = useState(0)
  const [previewItems, setPreviewItems] = useState<
    Array<{ name: string; quantity: number; unitPrice: number; totalValue: number; typeId?: number }>
  >([])
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!open || !escalation) return
    setTab('manual')
    setManualValue(escalation.lootValue ? String(escalation.lootValue) : '')
    setBeforeText(escalation.beforeCargoState || lastCargoState)
    setAfterText(escalation.afterCargoState || '')
    setPreviewTotal(0)
    setPreviewItems([])
  }, [open, escalation, lastCargoState])

  const calculateCargo = useCallback(async () => {
    if (!afterText.trim()) {
      setPreviewTotal(0)
      setPreviewItems([])
      return
    }
    setIsCalculating(true)
    try {
      const before = parseEVECargoEntries(beforeText)
      const after = parseEVECargoEntries(afterText)
      const lootItems: Array<{ name: string; quantity: number }> = []

      after.forEach((entry, key) => {
        const beforeQty = before.get(key)?.quantity || 0
        const delta = entry.quantity - beforeQty
        if (delta > 0) {
          lootItems.push({ name: entry.displayName, quantity: delta })
        }
      })

      if (lootItems.length === 0) {
        setPreviewTotal(0)
        setPreviewItems([])
        return
      }

      const names = lootItems.map((i) => i.name)
      const appraisal = await getMarketAppraisalDetailed(names)
      let total = 0
      const items = lootItems.map((item) => {
        const lookup =
          appraisal[item.name.toLowerCase()] ||
          appraisal[item.name] || { buyPrice: 0, unitPrice: 0, typeId: 0 }
        const unitPrice = lookup.buyPrice > 0 ? lookup.buyPrice : lookup.unitPrice
        const totalValue = unitPrice * item.quantity
        total += totalValue
        return {
          name: item.name,
          quantity: item.quantity,
          unitPrice,
          totalValue,
          typeId: lookup.typeId,
        }
      })
      setPreviewItems(items)
      setPreviewTotal(total)
    } finally {
      setIsCalculating(false)
    }
  }, [afterText, beforeText])

  useEffect(() => {
    if (tab !== 'cargo') return
    const timer = setTimeout(() => void calculateCargo(), 400)
    return () => clearTimeout(timer)
  }, [tab, afterText, beforeText, calculateCargo])

  const persistData = useCallback(
    async (updatedData: EscalationsActivityData) => {
      useActivityStore.getState().updateActivity(activity.id, { data: updatedData })
      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData }),
      })
      if (!response.ok) throw new Error('Failed to persist')
      const saved = await response.json()
      const serverData = (saved?.data ?? updatedData) as EscalationsActivityData
      useActivityStore.getState().updateActivity(activity.id, {
        data: { ...serverData, lastCargoState: afterText || serverData.lastCargoState },
      })
      onRefresh?.()
    },
    [activity.id, afterText, onRefresh]
  )

  const handleSave = async () => {
    if (!escalation) return

    const lootValue = tab === 'manual' ? parseIskInput(manualValue) : previewTotal
    if (lootValue <= 0) {
      toast.error(t('activity.escalations.lootValueRequired'))
      return
    }

    setIsSaving(true)
    try {
      const updated = setEscalationLoot(data, escalation.refId, {
        lootMode: tab,
        lootValue,
        beforeCargoState: tab === 'cargo' ? beforeText : undefined,
        afterCargoState: tab === 'cargo' ? afterText : undefined,
        lootContents:
          tab === 'cargo'
            ? previewItems.map((i) => ({
                name: i.name,
                quantity: i.quantity,
                unitPrice: i.unitPrice,
                totalValue: i.totalValue,
                typeId: i.typeId,
                value: i.totalValue,
              }))
            : undefined,
      })
      if (!updated) throw new Error('Escalation not found')
      await persistData(updated)
      toast.success(t('activity.escalations.lootRegistered', { value: formatISK(lootValue) }))
      onOpenChange(false)
    } catch {
      toast.error(t('activity.escalations.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const fieldClass = cn(
    'rounded-lg border border-orange-400/25 bg-black/30 text-orange-50',
    'text-xs focus-visible:ring-1 focus-visible:ring-orange-400/35'
  )

  if (!escalation) return null

  return (
    <EscalationsThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.types.escalations')}
      title={t('activity.escalations.registerLoot')}
      description={escalation.name}
      maxWidth="2xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-orange-200/70">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving || isCalculating}
            className="bg-orange-600/80 hover:bg-orange-600 text-white"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('activity.escalations.confirmLoot')}
          </Button>
        </div>
      }
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'manual' | 'cargo')}>
        <TabsList className="grid w-full grid-cols-2 bg-black/40">
          <TabsTrigger value="manual" className="text-[10px] uppercase">
            {t('activity.escalations.manualIsk')}
          </TabsTrigger>
          <TabsTrigger value="cargo" className="text-[10px] uppercase">
            {t('activity.escalations.cargoAppraisal')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual" className="mt-4 space-y-3">
          <Label className="text-[10px] uppercase text-orange-300/70">
            {t('activity.escalations.lootValue')}
          </Label>
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder="0"
            className={fieldClass}
          />
        </TabsContent>

        <TabsContent value="cargo" className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-orange-300/70">
              {t('activity.escalations.beforeCargo')}
            </Label>
            <Textarea
              value={beforeText}
              onChange={(e) => setBeforeText(e.target.value)}
              className={cn(fieldClass, 'min-h-20 font-mono')}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-orange-300/70">
              {t('activity.escalations.afterCargo')}
            </Label>
            <Textarea
              value={afterText}
              onChange={(e) => setAfterText(e.target.value)}
              placeholder={t('activity.escalations.afterCargoPlaceholder')}
              className={cn(fieldClass, 'min-h-24 font-mono')}
            />
          </div>
          {isCalculating ? (
            <p className="text-xs text-orange-300/60">{t('activity.escalations.calculating')}</p>
          ) : previewTotal > 0 ? (
            <p className="text-sm font-bold text-orange-200">
              {t('activity.escalations.jitaBuyTotal', { value: formatISK(previewTotal) })}
            </p>
          ) : null}
        </TabsContent>
      </Tabs>
    </EscalationsThemedDialog>
  )
}
