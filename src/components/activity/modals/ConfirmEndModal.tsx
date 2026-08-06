'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

interface ConfirmEndModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void | Promise<void>
  onRegisterFirst?: () => void
  pendingCount?: number
  activityName?: string
}

export function ConfirmEndModal({
  open,
  onOpenChange,
  onConfirm,
  onRegisterFirst,
  pendingCount = 0,
}: ConfirmEndModalProps) {
  const { t } = useTranslations()
  const hasPendingLoot = pendingCount > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm overflow-hidden rounded-sm border-eve-border bg-eve-dark p-0 text-white">
        <DialogHeader className="border-b border-eve-border/30 p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold text-eve-text">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            {t('activity.confirmEndTitle')}
          </DialogTitle>
          <DialogDescription className="mt-1 text-[11px] text-eve-muted">
            {t('activity.confirmEndDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 p-6">
          {hasPendingLoot && (
            <div className="flex items-start gap-3 rounded-sm border border-amber-500/25 bg-amber-500/5 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-amber-200/90">
                  {t('activity.confirmEndPendingTitle', { count: pendingCount })}
                </p>
                <p className="text-[11px] leading-relaxed text-eve-muted">
                  {t('activity.confirmEndPendingDescription')}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-sm border border-red-500/20 bg-red-500/5 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <div className="space-y-1">
              <p className="text-xs font-medium text-red-200/80">
                {t('activity.confirmEndSure')}
              </p>
              <p className="text-[11px] leading-relaxed text-eve-muted">
                {t('activity.confirmEndSureDescription')}
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col gap-2 border-t border-eve-border/30 p-4 sm:flex-col">
          {hasPendingLoot && onRegisterFirst && (
            <Button
              type="button"
              onClick={onRegisterFirst}
              className="h-10 w-full rounded-sm border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 hover:bg-amber-500/20"
            >
              {t('activity.confirmEndRegisterFirst')}
            </Button>
          )}
          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="h-10 flex-1 rounded-sm border-eve-border/30 bg-transparent text-xs text-eve-muted hover:bg-eve-panel hover:text-white"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              onClick={() => void onConfirm()}
              className="h-10 flex-1 rounded-sm border border-red-500/30 bg-red-500/10 text-xs text-red-400 hover:bg-red-500/20"
            >
              {t('activity.confirmEndAction')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
