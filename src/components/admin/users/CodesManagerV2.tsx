'use client'

import { useState } from 'react'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminCodes, useGenerateCodes, useDeleteCode } from '@/lib/admin/hooks/useAdminCodes'
import type { AdminCode } from '@/lib/admin/hooks/useAdminCodes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Copy, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

export function CodesManagerV2() {
  const { t } = useTranslations()
  const [page, setPage] = useState(1)
  const limit = 50
  const { data, isLoading } = useAdminCodes(page, limit)
  const generateMutation = useGenerateCodes()
  const deleteMutation = useDeleteCode()
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [type, setType] = useState('DAYS_30')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [deleteCode, setDeleteCode] = useState('')

  const handleCopy = async (code: string, id: string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success(t('admin.copied'))
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ count: parseInt(quantity, 10), type })
      toast.success(t('admin.codeGenerated30'))
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : t('admin.grantError')
      toast.error(msg)
    }
  }

  const handleDelete = async (codeId: string) => {
    try {
      await deleteMutation.mutateAsync(codeId)
      toast.success(t('admin.delete') + ' OK')
      setDeleteConfirmId(null)
    } catch {
      toast.error(t('admin.deleteError'))
    }
  }

  const columns = [
    {
      key: 'code',
      header: t('admin.code'),
      render: (item: AdminCode) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm">{item.code}</span>
          <button
            type="button"
            onClick={() => handleCopy(item.code, item.id)}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t('admin.copied')}
          >
            {copiedId === item.id ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      ),
    },
    {
      key: 'type',
      header: t('admin.type'),
      render: (item: AdminCode) => (
        <AdminBadge status="info">{item.type}</AdminBadge>
      ),
    },
    {
      key: 'status',
      header: t('admin.status'),
      render: (item: AdminCode) => {
        if (item.used) return <AdminBadge status="warning">{t('admin.used')}</AdminBadge>
        if (item.isInvalidated) return <AdminBadge status="error">{t('admin.codeInvalid')}</AdminBadge>
        return <AdminBadge status="success">{t('admin.unused')}</AdminBadge>
      },
    },
    {
      key: 'usedBy',
      header: t('admin.user'),
      render: (item: AdminCode) => (
        <span className="text-sm">{item.usedBy?.name || '—'}</span>
      ),
    },
    {
      key: 'created',
      header: t('admin.createdAt'),
      render: (item: AdminCode) => (
        <span className="text-sm text-muted-foreground tabular-nums">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: t('admin.action'),
      className: 'text-right',
      render: (item: AdminCode) => (
        <div className="flex justify-end">
          {!item.used && !item.isInvalidated && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={() => {
                setDeleteConfirmId(item.id)
                setDeleteCode(item.code)
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
        <Input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-20 h-9"
          aria-label={t('admin.codeType')}
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DAYS_7">{t('admin.codeDuration7')}</SelectItem>
            <SelectItem value="DAYS_30">{t('admin.codeDuration30')}</SelectItem>
            <SelectItem value="LIFETIME">{t('admin.codeDurationLifetime')}</SelectItem>
            <SelectItem value="PL8R">PL8R</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          {t('admin.generateCode')}
        </Button>
      </div>

      <AdminDataTable
        columns={columns}
        data={data?.codes || []}
        keyExtractor={(item) => item.id}
        emptyMessage={t('admin.noCodesGenerated')}
      />

      {data?.pagination && (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {data.pagination.total} {t('admin.generatedCodes').toLowerCase()}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="flex items-center text-sm tabular-nums px-2">
              {page} / {data.pagination.pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= data.pagination.pages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4">
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
            <h3 className="text-lg font-semibold">{t('admin.confirmDelete')}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t('admin.delete')} <span className="font-mono font-medium">{deleteCode}</span>?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
                {t('admin.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
              >
                {t('admin.delete')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
