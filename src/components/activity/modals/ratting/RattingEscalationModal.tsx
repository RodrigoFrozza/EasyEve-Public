'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { RattingThemedDialog, rattingModalTheme } from './RattingThemedDialog'
import { useTranslations } from '@/i18n/hooks'
import { formatISK, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { toast } from 'sonner'
import { AlertTriangle, Loader2, Trash2, CheckCircle2 } from 'lucide-react'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  appendEscalationDrop,
  dedupeEscalationDrops,
  deleteEscalationDrop,
  markEscalationSold,
  recalcEscalationTotals,
  type RattingActivityData,
  type RattingEscalationDrop,
} from '@/lib/activities/ratting-manual-entries'
import {
  CUSTOM_ESCALATION_SITE_ID,
  findEscalationOption,
  getEscalationsForFaction,
  RATTING_ESCALATIONS,
  type RattingEscalationOption,
} from '@/lib/constants/ratting-escalations'

interface RattingEscalationModalProps {
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

export function RattingEscalationModal({
  open,
  onOpenChange,
  activity,
  onRefresh,
}: RattingEscalationModalProps) {
  const { t } = useTranslations()
  const theme = rattingModalTheme
  const data = (activity.data || {}) as RattingActivityData

  const sessionFaction = data.npcFaction?.trim()
  const [showAllFactions, setShowAllFactions] = useState(false)
  const [selectedSiteKey, setSelectedSiteKey] = useState('')
  const [customSiteName, setCustomSiteName] = useState('')
  const [selectedChar, setSelectedChar] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [sellingRefId, setSellingRefId] = useState<string | null>(null)
  const [saleValueInput, setSaleValueInput] = useState('')
  const [saleDateInput, setSaleDateInput] = useState('')
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null)

  const escalationOptions = useMemo((): RattingEscalationOption[] => {
    if (showAllFactions) {
      return getEscalationsForFaction()
    }
    return getEscalationsForFaction(sessionFaction)
  }, [sessionFaction, showAllFactions])

  const drops = useMemo(
    () => dedupeEscalationDrops((data.escalationDrops || []) as RattingEscalationDrop[]),
    [data.escalationDrops]
  )

  const participants = activity.participants || []

  const persistData = useCallback(
    async (updatedData: RattingActivityData, deletedLogRefIds?: string[]) => {
      useActivityStore.getState().updateActivity(activity.id, { data: updatedData })

      const response = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: updatedData, deletedLogRefIds }),
      })
      if (!response.ok) throw new Error('Failed to persist')

      const saved = await response.json()
      const serverData = (saved?.data ?? updatedData) as RattingActivityData
      useActivityStore.getState().updateActivity(activity.id, { data: serverData })
      onRefresh?.()
      return serverData
    },
    [activity.id, onRefresh]
  )

  const repairedOnOpenRef = useRef(false)

  useEffect(() => {
    if (!open) {
      repairedOnOpenRef.current = false
      return
    }
    if (repairedOnOpenRef.current) return

    const raw = (data.escalationDrops || []) as RattingEscalationDrop[]
    if (raw.length === drops.length) return

    repairedOnOpenRef.current = true
    const repaired: RattingActivityData = {
      ...data,
      escalationDrops: drops,
      ...recalcEscalationTotals(drops),
    }
    void persistData(repaired)
  }, [open, data, drops, persistData])

  const resetForm = () => {
    setSelectedSiteKey('')
    setCustomSiteName('')
    setSelectedChar(participants[0]?.characterName || '')
  }

  const handleRegisterDrop = async () => {
    const isCustom = selectedSiteKey === CUSTOM_ESCALATION_SITE_ID
    const siteName = isCustom ? customSiteName.trim() : selectedSiteKey
    if (!siteName) {
      toast.error(t('activity.ratting.escalations.selectSiteRequired'))
      return
    }

    const option = isCustom ? undefined : findEscalationOption(siteName, sessionFaction)

    setIsRegistering(true)
    try {
      const updated = appendEscalationDrop(data, {
        siteName,
        dedRating: option?.dedRating,
        faction: option?.faction || sessionFaction,
        charName: selectedChar || participants[0]?.characterName,
      })
      await persistData(updated)
      toast.success(t('activity.ratting.escalations.dropRegistered'))
      resetForm()
    } catch {
      toast.error(t('activity.ratting.escalations.saveError'))
    } finally {
      setIsRegistering(false)
    }
  }

  const handleMarkSold = async (refId: string) => {
    const soldValue = parseIskInput(saleValueInput)
    if (soldValue <= 0) {
      toast.error(t('activity.ratting.escalations.saleValueRequired'))
      return
    }

    setSellingRefId(refId)
    try {
      const soldAt = saleDateInput
        ? new Date(saleDateInput).toISOString()
        : new Date().toISOString()
      const updated = markEscalationSold(data, refId, soldValue, soldAt)
      if (!updated) throw new Error('not found')
      await persistData(updated)
      toast.success(t('activity.ratting.escalations.saleRegistered', { value: formatISK(soldValue) }))
      setSellingRefId(null)
      setSaleValueInput('')
      setSaleDateInput('')
    } catch {
      toast.error(t('activity.ratting.escalations.saveError'))
    } finally {
      setSellingRefId(null)
    }
  }

  const handleDelete = async (refId: string) => {
    setDeletingRefId(refId)
    try {
      const updated = deleteEscalationDrop(data, refId)
      if (!updated) throw new Error('not found')
      await persistData(updated, [refId])
      toast.success(t('activity.ratting.escalations.deleted'))
    } catch {
      toast.error(t('activity.ratting.escalations.saveError'))
    } finally {
      setDeletingRefId(null)
    }
  }

  const fieldClass = cn(
    'rounded-lg border border-red-400/25 bg-black/30 text-sm backdrop-blur-sm',
    theme.text
  )

  return (
    <RattingThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.ratting.escalations.badge')}
      title={t('activity.ratting.escalations.title')}
      description={t('activity.ratting.escalations.description')}
      maxWidth="2xl"
      scrollable
    >
      <div className="space-y-6 p-1">
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <Label className={cn('text-xs font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.ratting.escalations.registerDrop')}
            </Label>
            {sessionFaction && escalationOptions.length < RATTING_ESCALATIONS.length && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] uppercase text-orange-300/80"
                onClick={() => setShowAllFactions((v) => !v)}
              >
                {showAllFactions
                  ? t('activity.ratting.escalations.factionOnly', { faction: sessionFaction })
                  : t('activity.ratting.escalations.showAllFactions')}
              </Button>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                {t('activity.ratting.escalations.selectSite')}
              </Label>
              <Select value={selectedSiteKey} onValueChange={setSelectedSiteKey}>
                <SelectTrigger className={fieldClass}>
                  <SelectValue placeholder={t('activity.ratting.escalations.selectSitePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {escalationOptions.map((opt) => (
                    <SelectItem
                      key={`${opt.faction}-${opt.dedRating}-${opt.siteName}`}
                      value={opt.siteName}
                    >
                      [{opt.dedRating}] {opt.siteName}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM_ESCALATION_SITE_ID}>
                    {t('activity.ratting.escalations.customSite')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedSiteKey === CUSTOM_ESCALATION_SITE_ID && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                  {t('activity.ratting.escalations.customSiteName')}
                </Label>
                <Input
                  value={customSiteName}
                  onChange={(e) => setCustomSiteName(e.target.value)}
                  placeholder={t('activity.ratting.escalations.customSitePlaceholder')}
                  className={fieldClass}
                />
              </div>
            )}

            {participants.length > 0 && (
              <div className="space-y-1.5">
                <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                  {t('activity.ratting.escalations.pilot')}
                </Label>
                <Select value={selectedChar} onValueChange={setSelectedChar}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder={t('activity.ratting.escalations.pilotPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {participants.map((p) => (
                      <SelectItem key={p.characterId} value={p.characterName || String(p.characterId)}>
                        {p.characterName || `Citizen ${p.characterId}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={handleRegisterDrop}
            disabled={isRegistering}
            className="w-full bg-orange-600 hover:bg-orange-500 text-white font-bold uppercase text-xs tracking-wide"
          >
            {isRegistering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <AlertTriangle className="h-4 w-4 mr-2" />
                {t('activity.ratting.escalations.registerDrop')}
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <Label className={cn('text-xs font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.ratting.escalations.sessionList')} ({drops.length})
          </Label>

          {drops.length === 0 ? (
            <p className={cn('text-sm text-center py-8', theme.textMuted)}>
              {t('activity.ratting.escalations.empty')}
            </p>
          ) : (
            <div className="max-h-[min(320px,40vh)] overflow-y-auto custom-scrollbar pr-2">
              <div className="space-y-2">
                {drops.map((drop, index) => (
                  <div
                    key={`${drop.refId}-${index}`}
                    className="rounded-lg border border-orange-500/15 bg-black/20 p-3 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-orange-50 text-sm truncate">
                          {drop.dedRating ? `[${drop.dedRating}] ` : ''}
                          {drop.siteName}
                        </p>
                        <p className={cn('text-[10px] mt-0.5', theme.textMuted)}>
                          {drop.charName && `${drop.charName} · `}
                          <FormattedDate date={drop.droppedAt} />
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[9px] uppercase',
                            drop.status === 'sold'
                              ? 'border-emerald-500/40 text-emerald-300'
                              : 'border-amber-500/40 text-amber-300'
                          )}
                        >
                          {drop.status === 'sold'
                            ? t('activity.ratting.escalations.sold')
                            : t('activity.ratting.escalations.pending')}
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400/70 hover:text-red-300"
                          disabled={deletingRefId === drop.refId}
                          onClick={() => handleDelete(drop.refId)}
                        >
                          {deletingRefId === drop.refId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>

                    {drop.status === 'sold' && drop.soldValue != null && (
                      <p className="text-sm font-mono text-emerald-300">
                        {formatISK(drop.soldValue)}
                        {drop.soldAt && (
                          <span className={cn('text-[10px] ml-2', theme.textMuted)}>
                            · <FormattedDate date={drop.soldAt} />
                          </span>
                        )}
                      </p>
                    )}

                    {drop.status === 'dropped' && (
                      sellingRefId === drop.refId ? (
                        <div className="grid gap-2 sm:grid-cols-2 pt-1">
                          <Input
                            value={saleValueInput}
                            onChange={(e) => setSaleValueInput(e.target.value)}
                            placeholder={t('activity.ratting.escalations.saleValuePlaceholder')}
                            className={fieldClass}
                          />
                          <Input
                            type="datetime-local"
                            value={saleDateInput}
                            onChange={(e) => setSaleDateInput(e.target.value)}
                            className={fieldClass}
                          />
                          <Button
                            type="button"
                            size="sm"
                            className="sm:col-span-2 bg-emerald-700 hover:bg-emerald-600"
                            disabled={sellingRefId === drop.refId && !saleValueInput}
                            onClick={() => handleMarkSold(drop.refId)}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            {t('activity.ratting.escalations.confirmSale')}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full border-orange-500/30 text-orange-200 hover:bg-orange-500/10"
                          onClick={() => {
                            setSellingRefId(drop.refId)
                            setSaleValueInput('')
                            setSaleDateInput('')
                          }}
                        >
                          {t('activity.ratting.escalations.markSold')}
                        </Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </RattingThemedDialog>
  )
}
