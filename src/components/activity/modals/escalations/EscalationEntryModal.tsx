'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { EscalationsThemedDialog } from './EscalationsThemedDialog'
import { useTranslations } from '@/i18n/hooks'
import { formatISK, cn } from '@/lib/utils'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  appendEscalation,
  DEFAULT_ESCALATION_VALIDITY_MS,
  type EscalationsActivityData,
} from '@/lib/activities/escalations-entries'
import {
  CUSTOM_ESCALATION_SITE_ID,
  findEscalationOption,
  getEscalationsForFaction,
} from '@/lib/constants/ratting-escalations'

interface EscalationEntryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity: {
    id: string
    participants?: Array<{ characterId: number; characterName?: string }>
    data?: Record<string, unknown>
  }
  onRefresh?: () => void
}

function parseIskInput(value: string): number {
  const cleaned = value.replace(/[^\d.]/g, '')
  const num = Number(cleaned)
  return Number.isFinite(num) && num >= 0 ? num : 0
}

export function EscalationEntryModal({
  open,
  onOpenChange,
  activity,
  onRefresh,
}: EscalationEntryModalProps) {
  const { t } = useTranslations()
  const data = (activity.data || {}) as EscalationsActivityData
  const sessionFaction = data.npcFaction?.trim()

  const [showAllFactions, setShowAllFactions] = useState(false)
  const [selectedSiteKey, setSelectedSiteKey] = useState('')
  const [customSiteName, setCustomSiteName] = useState('')
  const [purchasedFrom, setPurchasedFrom] = useState('')
  const [pricePaid, setPricePaid] = useState('')
  const [validityHours, setValidityHours] = useState('24')
  const [selectedChar, setSelectedChar] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const escalationOptions = useMemo(
    () => (showAllFactions ? getEscalationsForFaction() : getEscalationsForFaction(sessionFaction)),
    [sessionFaction, showAllFactions]
  )

  const participants = activity.participants || []

  useEffect(() => {
    if (!open) return
    setSelectedSiteKey('')
    setCustomSiteName('')
    setPurchasedFrom('')
    setPricePaid('')
    setValidityHours('24')
    setSelectedChar(participants[0]?.characterName || '')
  }, [open, participants])

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
      useActivityStore.getState().updateActivity(activity.id, { data: serverData })
      onRefresh?.()
    },
    [activity.id, onRefresh]
  )

  const handleSave = async () => {
    const isCustom = selectedSiteKey === CUSTOM_ESCALATION_SITE_ID
    const option = !isCustom && selectedSiteKey ? findEscalationOption(selectedSiteKey) : null
    const name = isCustom ? customSiteName.trim() : option?.siteName || ''
    if (!name) {
      toast.error(t('activity.escalations.selectSiteRequired'))
      return
    }

    const hours = Math.max(1, Number(validityHours) || 24)
    const acquiredAt = new Date().toISOString()
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
    const price = parseIskInput(pricePaid)

    setIsSaving(true)
    try {
      const updated = appendEscalation(data, {
        name,
        dedRating: option?.dedRating,
        faction: option?.faction || sessionFaction,
        purchasedFrom: purchasedFrom.trim() || undefined,
        pricePaid: price > 0 ? price : undefined,
        acquiredAt,
        expiresAt,
        charName: selectedChar || undefined,
      })
      await persistData(updated)
      toast.success(t('activity.escalations.buyRegistered'))
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

  return (
    <EscalationsThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.types.escalations')}
      title={t('activity.escalations.registerBuy')}
      description={t('activity.escalations.registerBuyDescription')}
      maxWidth="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-orange-200/70">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="bg-orange-600/80 hover:bg-orange-600 text-white"
          >
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('activity.escalations.confirmBuy')}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] uppercase tracking-wide text-orange-300/70">
            {t('activity.escalations.selectSite')}
          </Label>
          <button
            type="button"
            className="text-[10px] font-bold uppercase text-orange-400/80 hover:text-orange-300"
            onClick={() => setShowAllFactions((v) => !v)}
          >
            {showAllFactions
              ? t('activity.escalations.factionOnly', { faction: sessionFaction || '—' })
              : t('activity.escalations.showAllFactions')}
          </button>
        </div>

        <Select value={selectedSiteKey} onValueChange={setSelectedSiteKey}>
          <SelectTrigger className={fieldClass}>
            <SelectValue placeholder={t('activity.escalations.selectSitePlaceholder')} />
          </SelectTrigger>
          <SelectContent className="max-h-60 border-orange-500/20 bg-zinc-950">
            {escalationOptions.map((opt) => (
              <SelectItem key={opt.siteName} value={opt.siteName} className="text-xs">
                {opt.dedRating} · {opt.siteName}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM_ESCALATION_SITE_ID} className="text-xs text-orange-300">
              {t('activity.escalations.customSite')}
            </SelectItem>
          </SelectContent>
        </Select>

        {selectedSiteKey === CUSTOM_ESCALATION_SITE_ID && (
          <Input
            value={customSiteName}
            onChange={(e) => setCustomSiteName(e.target.value)}
            placeholder={t('activity.escalations.customSitePlaceholder')}
            className={fieldClass}
          />
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-orange-300/70">
              {t('activity.escalations.seller')}
            </Label>
            <Input
              value={purchasedFrom}
              onChange={(e) => setPurchasedFrom(e.target.value)}
              placeholder={t('activity.escalations.sellerPlaceholder')}
              className={fieldClass}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-orange-300/70">
              {t('activity.escalations.pricePaid')}
            </Label>
            <Input
              value={pricePaid}
              onChange={(e) => setPricePaid(e.target.value)}
              placeholder="0"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase text-orange-300/70">
              {t('activity.escalations.validityHours')}
            </Label>
            <Input
              type="number"
              min={1}
              value={validityHours}
              onChange={(e) => setValidityHours(e.target.value)}
              className={fieldClass}
            />
            <p className="text-[9px] text-orange-300/40">
              {t('activity.escalations.validityDefault', {
                hours: DEFAULT_ESCALATION_VALIDITY_MS / (60 * 60 * 1000),
              })}
            </p>
          </div>
          {participants.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase text-orange-300/70">
                {t('activity.escalations.pilot')}
              </Label>
              <Select value={selectedChar} onValueChange={setSelectedChar}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder={t('activity.escalations.pilotPlaceholder')} />
                </SelectTrigger>
                <SelectContent className="border-orange-500/20 bg-zinc-950">
                  {participants.map((p) => (
                    <SelectItem key={p.characterId} value={p.characterName || String(p.characterId)}>
                      {p.characterName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {parseIskInput(pricePaid) > 0 && (
          <p className="text-xs text-orange-200/60">
            {t('activity.escalations.costPreview', { value: formatISK(parseIskInput(pricePaid)) })}
          </p>
        )}
      </div>
    </EscalationsThemedDialog>
  )
}
