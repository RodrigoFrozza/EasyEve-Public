'use client'

import { useState } from 'react'
import { Download, Terminal, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { AccountDetailDialogV2 } from './AccountDetailDialogV2'
import { useAdminAccounts, type AdminAccount } from '@/lib/admin/hooks/useAdminAccounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { AdminTable } from '@/components/admin/shared/AdminTable'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function AccountListV2() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const limit = 10
  const [selectedAccount, setSelectedAccount] = useState<AdminAccount | null>(null)

  const { data, isLoading } = useAdminAccounts(page, limit, search, filter)

  const exportToCsv = () => {
    if (!data?.accounts) return
    const headers = ['Name', 'Account Code', 'Role', 'Status', 'Subscription End', 'Created At']
    const csvData = data.accounts.map(acc => [
      acc.name || '',
      acc.accountCode || '',
      acc.role,
      acc.isBlocked ? 'Blocked' : 'Active',
      acc.subscriptionEnd || 'None',
      acc.createdAt || ''
    ])
    
    const csv = [
      headers,
      ...csvData
    ].map(row => 
      row.map(cell => {
        const str = String(cell ?? '')
        return `"${str.replace(/"/g, '""')}"`
      }).join(',')
    ).join('\n')
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts-export-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Accounts exported successfully')
  }

  const columns = [
    {
      key: 'user',
      header: 'User',
      render: (account: AdminAccount) => {
        const mainChar = account.characters?.find((c: any) => c.isMain) || account.characters?.[0]
        const avatarSrc = mainChar ? `https://images.evetech.net/characters/${mainChar.id}/portrait?size=64` : ''
        return (
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => setSelectedAccount(account)}
          >
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarSrc} />
              <AvatarFallback className="bg-eve-accent/20 text-eve-accent text-xs">
                {account.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-eve-text">{account.name || 'Unknown'}</p>
              <p className="text-xs text-eve-text/40">{account.accountCode || ''}</p>
            </div>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Role',
      render: (account: AdminAccount) => (
        <AdminBadge status={account.role === 'master' ? 'error' : 'info'}>
          {account.role}
        </AdminBadge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (account: AdminAccount) => {
        const isExpired = account.subscriptionEnd && new Date(account.subscriptionEnd) < new Date()
        return (
          <div className="flex flex-col gap-1">
            <AdminBadge status={account.isBlocked ? 'error' : isExpired ? 'warning' : 'success'}>
              {account.isBlocked ? 'Blocked' : isExpired ? 'Expired' : 'Active'}
            </AdminBadge>
            {account.isTester && <span className="text-[10px] text-blue-400 font-bold uppercase ml-1">Tester</span>}
          </div>
        )
      }
    },
    {
      key: 'subscription',
      header: 'Subscription',
      render: (account: AdminAccount) => {
        if (!account.subscriptionEnd) return <span className="text-sm text-eve-text/40 italic">Free</span>
        const isExpired = new Date(account.subscriptionEnd) < new Date()
        return (
          <span className={cn("text-sm font-medium", isExpired ? "text-red-400" : "text-eve-text/60")}>
            {new Date(account.subscriptionEnd).toLocaleDateString()}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: '',
      render: (account: AdminAccount) => (
        <div className="flex items-center justify-end gap-2 pr-4">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-eve-text/40 hover:text-eve-accent"
            onClick={(e) => {
              e.stopPropagation()
              window.location.href = `/dashboard/admin/logs/${account.id}`
            }}
            title="View Logs"
          >
            <Terminal className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-eve-text/40 hover:text-eve-accent"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedAccount(account)
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      ),
    },
  ]

  if (isLoading) {
    return <div className="space-y-3">
      {[1,2,3].map(i => (
        <div key={i} className="h-16 bg-eve-panel/60 animate-pulse rounded-lg" />
      ))}
    </div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex items-center gap-2 flex-1 w-full max-w-sm">
          <Search className="w-4 h-4 text-eve-text/40" />
          <Input
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-eve-panel/60 border-eve-border/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex p-1 bg-eve-panel/40 border border-eve-border/30 rounded-lg">
            {['all', 'active', 'blocked', 'expired', 'tester'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all",
                  filter === f 
                    ? "bg-eve-accent text-black shadow-lg" 
                    : "text-eve-text/40 hover:text-eve-text hover:bg-white/5"
                )}
              >
                {f}
              </button>
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={exportToCsv}
            className="border-eve-border/30 gap-2 h-9 text-[10px] font-bold uppercase tracking-wider"
          >
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>
      </div>

      <AdminTable
        columns={columns}
        data={data?.accounts || []}
        keyExtractor={(account) => account.id}
        emptyMessage="No accounts found"
      />

      {data?.pagination && (
        <div className="flex items-center justify-between mt-6">
          <span className="text-sm text-eve-text/40">
            Total: <span className="text-eve-text font-medium">{data.pagination.total}</span> accounts
          </span>
          <div className="flex items-center gap-4">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-eve-border/30"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center px-3 h-8 bg-eve-panel/40 border border-eve-border/30 rounded-md">
                <span className="text-xs font-medium text-eve-text/60">
                  {page} <span className="text-eve-text/20 mx-1">/</span> {data.pagination.pages}
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0 border-eve-border/30"
                onClick={() => setPage(p => p + 1)}
                disabled={page >= data.pagination.pages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
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
