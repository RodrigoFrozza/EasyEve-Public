'use client'

import { useState } from 'react'
import { Download, Terminal, ChevronLeft, ChevronRight } from 'lucide-react'
import { AccountDetailDialogV2 } from './AccountDetailDialogV2'
import { useAdminAccounts, type AdminAccount } from '@/lib/admin/hooks/useAdminAccounts'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { AdminDataTable } from '@/components/admin/shared/AdminDataTable'
import { AdminToolbar } from '@/components/admin/shared/AdminToolbar'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

export function AccountListV2() {
  const { t } = useTranslations()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const limit = 10
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null)

  const { data, isLoading } = useAdminAccounts(page, limit, search, filter)

  const filterOptions = [
    { value: 'all', label: t('admin.filterAll') },
    { value: 'active', label: t('admin.filterActive') },
    { value: 'blocked', label: t('admin.filterBlocked') },
    { value: 'expired', label: t('admin.filterExpired') },
    { value: 'tester', label: t('admin.filterTester') ?? 'Tester' },
  ]

  const exportToCsv = () => {
    if (!data?.accounts) return
    const headers = ['Name', 'Account Code', 'Role', 'Status', 'Subscription End', 'Created At']
    const csvData = data.accounts.map((acc) => [
      acc.name || '',
      acc.accountCode || '',
      acc.role,
      acc.isBlocked ? 'Blocked' : 'Active',
      acc.subscriptionEnd || 'None',
      acc.createdAt || '',
    ])

    const csv = [headers, ...csvData]
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '')
            return `"${str.replace(/"/g, '""')}"`
          })
          .join(',')
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(t('admin.exportSuccess') ?? 'Export completed')
  }

  const columns = [
    {
      key: 'user',
      header: t('admin.user'),
      render: (account: AdminAccount) => {
        const mainChar =
          account.characters?.find((c: { isMain?: boolean }) => c.isMain) ||
          account.characters?.[0]
        const avatarSrc = mainChar
          ? `https://images.evetech.net/characters/${mainChar.id}/portrait?size=64`
          : ''
        return (
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setSelectedAccount(account)}
          >
            <Avatar className="h-8 w-8 rounded-[8px] border border-white/[0.08]">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className="rounded-[8px] bg-gradient-to-br from-[#1c2a3a] to-[#0e1822] text-xs text-ta-secondary">
                {account.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-accent text-[13px] font-semibold text-ta-bright hover:text-eve-accent">
                {account.name || t('admin.noName')}
              </p>
              <p className="text-xs text-ta-muted">
                {account.accountCode || '—'}
              </p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: t('admin.type'),
      render: (account: AdminAccount) => (
        <AdminBadge status={account.role === 'master' ? 'error' : 'info'}>
          {account.role}
        </AdminBadge>
      ),
    },
    {
      key: 'status',
      header: t('admin.status'),
      render: (account: AdminAccount) => {
        const isExpired =
          account.subscriptionEnd &&
          new Date(account.subscriptionEnd) < new Date()
        return (
          <div className="flex items-center gap-2">
            <AdminBadge
              status={
                account.isBlocked ? 'error' : isExpired ? 'warning' : 'success'
              }
            >
              {account.isBlocked
                ? t('admin.filterBlocked')
                : isExpired
                  ? t('admin.filterExpired')
                  : t('admin.filterActive')}
            </AdminBadge>
            {account.isTester && (
              <span className="text-[11px] text-eve-accent font-semibold">Tester</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'subscription',
      header: t('admin.subscription'),
      render: (account: AdminAccount) => {
        if (!account.subscriptionEnd) {
          return <span className="text-sm text-ta-muted">—</span>
        }
        const isExpired = new Date(account.subscriptionEnd) < new Date()
        return (
          <span
            className={cn(
              'font-sans text-sm tabular-nums',
              isExpired ? 'text-ta-muted' : 'text-ta-body'
            )}
          >
            {new Date(account.subscriptionEnd).toLocaleDateString()}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: t('admin.actions'),
      className: 'text-right',
      render: (account: AdminAccount) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              window.location.href = `/dashboard/admin/logs/${account.id}`
            }}
            title={t('admin.nav.logs')}
          >
            <Terminal className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedAccount(account)
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14 w-full rounded-lg" />
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <AdminToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={t('admin.searchPlaceholder')}
        filters={filterOptions}
        activeFilter={filter}
        onFilterChange={setFilter}
        actions={
          <Button variant="outline" size="sm" onClick={exportToCsv} className="gap-2">
            <Download className="h-4 w-4" />
            {t('admin.exportData') ?? 'Export'}
          </Button>
        }
      />

      <AdminDataTable
        columns={columns}
        data={data?.accounts?.filter(Boolean) || []}
        keyExtractor={(account) => account?.id}
        emptyMessage={t('admin.noAccountFound')}
      />

      {data?.pagination && (
        <div className="flex items-center justify-between rounded-[12px] border border-white/[0.06] bg-white/[0.02] px-4 py-3">
          <span className="text-sm text-ta-muted">
            {data.pagination.total.toLocaleString()} {t('admin.accounts').toLowerCase()}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-sans text-sm tabular-nums px-2 text-ta-body">
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

      <AccountDetailDialogV2
        account={selectedAccount}
        isOpen={!!selectedAccount}
        onClose={() => setSelectedAccount(null)}
      />
    </div>
  )
}
