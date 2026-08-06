'use client'

import { useState } from 'react'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import {
  useAdminTesterApplications,
  useApproveTester,
  useRejectTester,
} from '@/lib/admin/hooks/useAdminTesterApplications'
import type { TesterApplication } from '@/lib/admin/hooks/useAdminTesterApplications'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserCheck, UserX } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

const REJECT_MIN_LENGTH = 10

type ReviewAction = 'approve' | 'reject'

export function TesterApplicationsManagerV2() {
  const { t } = useTranslations()
  const { data, isLoading } = useAdminTesterApplications()
  const approveMutation = useApproveTester()
  const rejectMutation = useRejectTester()

  const [dialogState, setDialogState] = useState<
    { action: ReviewAction; application: TesterApplication } | null
  >(null)
  const [reviewNotes, setReviewNotes] = useState('')

  const isPending = approveMutation.isPending || rejectMutation.isPending

  const openDialog = (action: ReviewAction, application: TesterApplication) => {
    setDialogState({ action, application })
    setReviewNotes('')
  }

  const closeDialog = () => {
    setDialogState(null)
    setReviewNotes('')
  }

  const handleConfirm = async () => {
    if (!dialogState) return
    const { action, application } = dialogState
    const trimmed = reviewNotes.trim()

    try {
      if (action === 'approve') {
        await approveMutation.mutateAsync({
          id: application.id,
          reviewNotes: trimmed.length > 0 ? trimmed : undefined,
        })
        toast.success(t('admin.tester.approved'))
      } else {
        if (trimmed.length < REJECT_MIN_LENGTH) {
          toast.error(t('admin.tester.rejectMinLength', { min: REJECT_MIN_LENGTH }))
          return
        }
        await rejectMutation.mutateAsync({
          id: application.id,
          reviewNotes: trimmed,
        })
        toast.success(t('admin.tester.rejected'))
      }
      closeDialog()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('admin.errorPrefix')
      toast.error(message)
    }
  }

  const columns = [
    {
      key: 'user',
      header: t('admin.user'),
      render: (item: TesterApplication) => (
        <div>
          <p className="text-sm font-medium">{item.user.name || t('admin.noName')}</p>
          <p className="text-xs text-muted-foreground">
            {item.user.accountCode || item.userId}
          </p>
        </div>
      ),
    },
    {
      key: 'description',
      header: t('admin.tester.application'),
      render: (item: TesterApplication) => (
        <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">
          {item.description}
        </p>
      ),
    },
    {
      key: 'status',
      header: t('admin.status'),
      render: (item: TesterApplication) => (
        <AdminBadge
          status={
            item.status === 'approved'
              ? 'success'
              : item.status === 'rejected'
                ? 'error'
                : 'warning'
          }
        >
          {item.status}
        </AdminBadge>
      ),
    },
    {
      key: 'date',
      header: t('admin.createdAt'),
      render: (item: TesterApplication) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.action'),
      className: 'text-right',
      render: (item: TesterApplication) =>
        item.status === 'pending' && (
          <div className="flex gap-1 justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-600"
              onClick={() => openDialog('approve', item)}
              disabled={isPending}
              aria-label={t('admin.approve')}
            >
              <UserCheck className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => openDialog('reject', item)}
              disabled={isPending}
              aria-label={t('admin.reject')}
            >
              <UserX className="h-4 w-4" />
            </Button>
          </div>
        ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  const action = dialogState?.action
  const application = dialogState?.application
  const trimmedLength = reviewNotes.trim().length
  const rejectTooShort = action === 'reject' && trimmedLength < REJECT_MIN_LENGTH
  const confirmDisabled = isPending || (action === 'reject' && rejectTooShort)

  return (
    <div className="space-y-4">
      <AdminDataTable
        columns={columns}
        data={data?.applications || []}
        keyExtractor={(item) => item.id}
        emptyMessage={t('admin.tester.empty')}
      />

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? t('admin.approve') : t('admin.reject')}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? t('admin.tester.approveDesc')
                : t('admin.tester.rejectDesc', { min: REJECT_MIN_LENGTH })}
            </DialogDescription>
          </DialogHeader>

          {application && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-sm font-medium">{application.user.name}</p>
                <p className="text-xs text-muted-foreground">
                  {application.user.accountCode || application.userId}
                </p>
                <p className="text-sm text-muted-foreground italic border-t border-border pt-2 mt-2">
                  {application.description}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="review-notes">
                    {action === 'approve'
                      ? t('admin.tester.notesOptional')
                      : t('admin.tester.rejectReason')}
                  </Label>
                  {action === 'reject' && (
                    <span
                      className={cn(
                        'text-xs text-muted-foreground',
                        rejectTooShort && trimmedLength > 0 && 'text-amber-600'
                      )}
                    >
                      {trimmedLength} / {REJECT_MIN_LENGTH}
                    </span>
                  )}
                </div>
                <Textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className={cn('min-h-[100px]', rejectTooShort && 'border-amber-500/50')}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              {t('admin.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmDisabled}
              variant={action === 'reject' ? 'destructive' : 'default'}
            >
              {action === 'approve' ? t('admin.approve') : t('admin.reject')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
