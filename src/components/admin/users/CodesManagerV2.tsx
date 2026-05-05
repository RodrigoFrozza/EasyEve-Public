'use client'

import { useState } from 'react'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { useAdminCodes, useGenerateCodes, useDeleteCode } from '@/lib/admin/hooks/useAdminCodes'
import type { AdminCode } from '@/lib/admin/hooks/useAdminCodes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Key, Plus, Copy, Check, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

export function CodesManagerV2() {
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
    toast.success('Code copied')
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleGenerate = async () => {
    try {
      await generateMutation.mutateAsync({ count: parseInt(quantity), type })
      toast.success('Codes generated')
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate codes')
    }
  }

  const handleDelete = async (codeId: string) => {
    try {
      await deleteMutation.mutateAsync(codeId)
      toast.success('Code deleted')
      setDeleteConfirmId(null)
    } catch {
      toast.error('Failed to delete code')
    }
  }

  const columns = [
    {
      key: 'code',
      header: 'Code',
      render: (item: AdminCode) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-eve-text">{item.code}</span>
          <Button size="sm" variant="ghost" onClick={() => handleCopy(item.code, item.id)}>
            {copiedId === item.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </Button>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (item: AdminCode) => (
        <AdminBadge status={item.type === 'premium' ? 'warning' : 'info'}>
          {item.type}
        </AdminBadge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item: AdminCode) => (
        <AdminBadge status={item.used ? 'error' : 'success'}>
          {item.used ? 'Used' : 'Available'}
        </AdminBadge>
      ),
    },
    {
      key: 'usedBy',
      header: 'Used By',
      render: (item: AdminCode) => (
        <span className="text-sm text-eve-text/60">
          {item.usedBy?.name || '-'}
        </span>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      render: (item: AdminCode) => (
        <span className="text-sm text-eve-text/60">
          {new Date(item.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (item: AdminCode) => (
        <div className="flex gap-1">
          {!item.used && !item.isInvalidated && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDeleteConfirmId(item.id)
                setDeleteCode(item.code)
              }}
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Input 
            type="number" 
            placeholder="Quantity" 
            value={quantity} 
            onChange={(e) => setQuantity(e.target.value)}
            className="w-24 bg-eve-panel/60 border-eve-border/30" 
          />
          <select
             value={type}
             onChange={(e) => setType(e.target.value)}
             className="bg-eve-panel/60 border-eve-border/30 rounded-md px-3 py-2 text-sm"
           >
             <option value="DAYS_7">7 Days</option>
             <option value="DAYS_30">30 Days</option>
             <option value="LIFETIME">Lifetime</option>
             <option value="PL8R">PL8R</option>
           </select>
          <Button 
            size="sm" 
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="bg-eve-accent/20 text-eve-accent"
          >
            <Plus className="w-4 h-4 mr-2" />
            Generate
          </Button>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={data?.codes || []}
        keyExtractor={(item) => item.id}
        emptyMessage="No codes found"
      />

      {data?.pagination && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-eve-text/60">
            Total: {data.pagination.total} codes
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-eve-text/60 px-2">{page} / {data.pagination.pages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= data.pagination.pages}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-eve-panel border border-eve-border/30 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-eve-text mb-2">Delete Code</h3>
            <p className="text-sm text-eve-text/60 mb-4">
              Are you sure you want to delete code <span className="font-mono text-eve-accent">{deleteCode}</span>?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirmId(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => handleDelete(deleteConfirmId)}
                disabled={deleteMutation.isPending}
                className="bg-red-500/20 text-red-400 hover:bg-red-500/30"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

