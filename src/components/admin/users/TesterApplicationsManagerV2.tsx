'use client'

import { useState } from 'react'
import { AdminTable } from '@/components/admin/shared/AdminTable'
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

const REJECT_MIN_LENGTH = 10

type ReviewAction = 'approve' | 'reject'

export function TesterApplicationsManagerV2() {
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
        toast.success('Application approved')
      } else {
        if (trimmed.length < REJECT_MIN_LENGTH) {
          toast.error(`Rejection reason must be at least ${REJECT_MIN_LENGTH} characters`)
          return
        }
        await rejectMutation.mutateAsync({
          id: application.id,
          reviewNotes: trimmed,
        })
        toast.success('Application rejected')
      }
      closeDialog()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : `Failed to ${action} application`
      toast.error(message)
    }
  }

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (item: TesterApplication) => (
        <div>
          <p className="text-eve-text">{item.user.name || 'Unknown'}</p>
          <p className="text-xs text-eve-text/40">{item.user.accountCode}</p>
        </div>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (item: TesterApplication) => (
        <span className="text-sm text-eve-text/60 line-clamp-2 block max-w-md">
          {item.description}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
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
      header: 'Date',
      render: (item: TesterApplication) => (
        <span className="text-sm text-eve-text/60">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: TesterApplication) =>
        item.status === 'pending' && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog('approve', item)}
              disabled={isPending}
              className="text-green-400 border-green-400/30 hover:bg-green-400/10"
              aria-label="Approve application"
            >
              <UserCheck className="w-3 h-3" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openDialog('reject', item)}
              disabled={isPending}
              className="text-red-400 border-red-400/30 hover:bg-red-400/10"
              aria-label="Reject application"
            >
              <UserX className="w-3 h-3" />
            </Button>
          </div>
        ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded" />
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
      <AdminTable
        columns={columns}
        data={data?.applications || []}
        keyExtractor={(item) => item.id}
        emptyMessage="No pending applications"
      />

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'approve' ? 'Approve tester application' : 'Reject tester application'}
            </DialogTitle>
            <DialogDescription>
              {action === 'approve'
                ? 'The user will receive full EasyEve access until manually revoked.'
                : `The user will be notified and placed on a cooldown before they can re-apply. Please provide a reason (min ${REJECT_MIN_LENGTH} characters).`}
            </DialogDescription>
          </DialogHeader>

          {application && (
            <div className="space-y-4">
              <div className="rounded-md border border-eve-border/40 bg-eve-dark/30 p-3 text-sm">
                <p className="font-semibold text-eve-text">
                  {application.user.name || application.user.accountCode || application.userId}
                </p>
                {application.user.accountCode && (
                  <p className="text-xs text-eve-text/40">{application.user.accountCode}</p>
                )}
                <p className="mt-2 whitespace-pre-wrap text-eve-text/70">
                  {application.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="review-notes">
                  {action === 'approve' ? 'Approval note (optional)' : 'Rejection reason'}
                </Label>
                <Textarea
                  id="review-notes"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder={
                    action === 'approve'
                      ? 'Optional note shared with the user'
                      : `Explain why the application is being rejected (min ${REJECT_MIN_LENGTH} characters)`
                  }
                  className={cn(
                    'min-h-[100px]',
                    rejectTooShort && trimmedLength > 0 && 'border-amber-500/60',
                  )}
                />
                <p
                  className={cn(
                    'text-[10px] uppercase tracking-wider',
                    rejectTooShort && trimmedLength > 0
                      ? 'text-amber-400'
                      : 'text-eve-text/40',
                  )}
                >
                  {action === 'reject' && rejectTooShort && trimmedLength > 0
                    ? `Need ${REJECT_MIN_LENGTH - trimmedLength} more character${REJECT_MIN_LENGTH - trimmedLength === 1 ? '' : 's'}`
                    : `${trimmedLength} character${trimmedLength === 1 ? '' : 's'}`}
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isPending}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className={
                action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }
            >
              {isPending
                ? 'Working...'
                : action === 'approve'
                  ? 'Approve'
                  : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
