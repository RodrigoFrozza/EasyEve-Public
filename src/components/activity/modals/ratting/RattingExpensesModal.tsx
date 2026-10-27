'use client'

import { useCallback, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { Loader2, Trash2, TrendingDown } from 'lucide-react'
import { useActivityStore } from '@/lib/stores/activity-store'
import {
  appendRattingExpense,
  dedupeRattingExpenses,
  deleteRattingExpense,
  type RattingActivityData,
  type RattingExpenseEntry,
} from '@/lib/activities/ratting-manual-entries'

interface RattingExpensesModalProps {
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

export function RattingExpensesModal({
  open,
  onOpenChange,
  activity,
  onRefresh,
}: RattingExpensesModalProps) {
  const { t } = useTranslations()
  const theme = rattingModalTheme
  const data = (activity.data || {}) as RattingActivityData

  const [amountInput, setAmountInput] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [selectedChar, setSelectedChar] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deletingRefId, setDeletingRefId] = useState<string | null>(null)

  const expenses = useMemo(
    () => dedupeRattingExpenses((data.sessionExpenses || []) as RattingExpenseEntry[]),
    [data.sessionExpenses]
  )

  const totalExpenses = Number(data.estimatedExpenseValue) || 0
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

  const resetForm = () => {
    setAmountInput('')
    setNoteInput('')
    setSelectedChar(participants[0]?.characterName || '')
  }

  const handleRegisterExpense = async () => {
    const amount = parseIskInput(amountInput)
    if (amount <= 0) {
      toast.error(t('activity.ratting.expenses.amountRequired'))
      return
    }

    setIsSaving(true)
    try {
      const updated = appendRattingExpense(data, {
        amount,
        note: noteInput.trim() || undefined,
        charName: selectedChar || participants[0]?.characterName,
      })
      await persistData(updated)
      toast.success(t('activity.ratting.expenses.registered', { value: formatISK(amount) }))
      resetForm()
    } catch {
      toast.error(t('activity.ratting.expenses.saveError'))
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (refId: string) => {
    setDeletingRefId(refId)
    try {
      const updated = deleteRattingExpense(data, refId)
      if (!updated) throw new Error('not found')
      await persistData(updated, [refId])
      toast.success(t('activity.ratting.expenses.deleted'))
    } catch {
      toast.error(t('activity.ratting.expenses.saveError'))
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
      badge={t('activity.ratting.expenses.badge')}
      title={t('activity.ratting.expenses.title')}
      description={t('activity.ratting.expenses.description')}
      maxWidth="2xl"
      scrollable
    >
      <div className="space-y-6 p-1">
        <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 space-y-4">
          <Label className={cn('text-xs font-bold uppercase tracking-wide', theme.textMuted)}>
            {t('activity.ratting.expenses.register')}
          </Label>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                {t('activity.ratting.expenses.amount')}
              </Label>
              <Input
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder={t('activity.ratting.expenses.amountPlaceholder')}
                className={fieldClass}
              />
            </div>

            {participants.length > 0 && (
              <div className="space-y-1.5">
                <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                  {t('activity.ratting.expenses.pilot')}
                </Label>
                <Select value={selectedChar} onValueChange={setSelectedChar}>
                  <SelectTrigger className={fieldClass}>
                    <SelectValue placeholder={t('activity.ratting.expenses.pilotPlaceholder')} />
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

            <div className="space-y-1.5 sm:col-span-2">
              <Label className={cn('text-[10px] uppercase', theme.textMuted)}>
                {t('activity.ratting.expenses.note')}
                <span className="ml-1 normal-case text-red-300/40">
                  ({t('activity.ratting.expenses.optional')})
                </span>
              </Label>
              <Textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder={t('activity.ratting.expenses.notePlaceholder')}
                rows={2}
                className={cn(fieldClass, 'resize-none')}
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={handleRegisterExpense}
            disabled={isSaving}
            className="w-full bg-rose-700 hover:bg-rose-600 text-white font-bold uppercase text-xs tracking-wide"
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <TrendingDown className="h-4 w-4 mr-2" />
                {t('activity.ratting.expenses.register')}
              </>
            )}
          </Button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className={cn('text-xs font-bold uppercase tracking-wide', theme.textMuted)}>
              {t('activity.ratting.expenses.sessionList')} ({expenses.length})
            </Label>
            {totalExpenses > 0 && (
              <span className="text-xs font-mono font-bold text-rose-300">
                -{formatISK(totalExpenses)}
              </span>
            )}
          </div>

          {expenses.length === 0 ? (
            <p className={cn('text-sm text-center py-8', theme.textMuted)}>
              {t('activity.ratting.expenses.empty')}
            </p>
          ) : (
            <div className="max-h-[min(320px,40vh)] overflow-y-auto custom-scrollbar pr-2">
              <div className="space-y-2">
                {expenses.map((entry, index) => (
                  <div
                    key={`${entry.refId}-${index}`}
                    className="rounded-lg border border-rose-500/15 bg-black/20 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-rose-50 text-sm truncate">
                          {entry.note || t('activity.ratting.expenses.unlabeled')}
                        </p>
                        <p className={cn('text-[10px] mt-0.5', theme.textMuted)}>
                          {entry.charName && `${entry.charName} · `}
                          <FormattedDate date={entry.recordedAt} />
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-mono font-bold text-rose-300 tabular-nums">
                          -{formatISK(entry.amount)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-400/70 hover:text-red-300"
                          disabled={deletingRefId === entry.refId}
                          onClick={() => handleDelete(entry.refId)}
                        >
                          {deletingRefId === entry.refId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
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
