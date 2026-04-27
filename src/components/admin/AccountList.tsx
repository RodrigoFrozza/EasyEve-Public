'use client'
import { useState, useMemo } from 'react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Users, Search, Shield, Ban, Zap, Clock, ChevronRight, Terminal, Trash2, Download
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn, getRemainingDays } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'

export interface Character {
  id: number
  name: string
  isMain: boolean
  location?: string | null
  ship?: string | null
  walletBalance?: number
}

export interface AccountData {
  id: string
  accountCode: string | null
  name: string | null
  role: string
  isBlocked: boolean
  subscriptionEnd: string | null
  lastLoginAt: string | null
  allowedActivities: string[]
  characters: Character[]
  createdAt: string
  discordId: string | null
  discordName: string | null
  _count: {
    characters: number
    activities: number
  }
}

interface AccountListProps {
  accounts: AccountData[]
  onSelectAccount: (account: AccountData) => void
}

export function AccountList({ accounts, onSelectAccount }: AccountListProps) {
  const { t } = useTranslations()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'blocked' | 'expired' | 'new'>('all')
  const [dateFilter, setDateFilter] = useState<string>('')

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => {
      const matchesSearch = 
        acc.name?.toLowerCase().includes(search.toLowerCase()) || 
        acc.accountCode?.toLowerCase().includes(search.toLowerCase()) ||
        acc.id?.toLowerCase().includes(search.toLowerCase())
      
      const isExpired = acc.subscriptionEnd && new Date(acc.subscriptionEnd) < new Date()
      const isNew = acc.createdAt && new Date(acc.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      
      if (filter === 'active') return matchesSearch && !acc.isBlocked && !isExpired
      if (filter === 'blocked') return matchesSearch && acc.isBlocked
      if (filter === 'expired') return matchesSearch && isExpired
      if (filter === 'new') return matchesSearch && isNew
      return matchesSearch
    })
  }, [accounts, search, filter])

  const exportToCsv = () => {
    const headers = ['Name', 'Account Code', 'Role', 'Blocked', 'Subscription End', 'Created At', 'Characters']
    const csvData = filteredAccounts.map(acc => [
      acc.name || '',
      acc.accountCode || '',
      acc.role,
      acc.isBlocked ? 'Yes' : 'No',
      acc.subscriptionEnd || 'None',
      acc.createdAt,
      acc._count.characters.toString()
    ])
    
    const csv = [headers, ...csvData].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Accounts exported successfully')
  }

return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input 
            placeholder={t('admin.searchPlaceholder')} 
            className="pl-10 bg-eve-panel border-eve-border text-white placeholder:text-gray-500"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
           {(['all', 'active', 'blocked', 'expired'] as const).map((f) => (
             <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                    "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all",
                    filter === f 
                        ? "bg-eve-accent text-black shadow-lg shadow-eve-accent/20" 
                        : "bg-eve-panel text-gray-400 hover:text-white border border-eve-border"
                )}
             >
                {f === 'all' ? t('admin.filterAll') : f === 'active' ? t('admin.filterActive') : f === 'blocked' ? t('admin.filterBlocked') : t('admin.filterExpired')}
             </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-eve-border/30 bg-eve-panel overflow-hidden">
        <Table>
          <TableHeader className="bg-eve-dark/50">
            <TableRow className="border-eve-border/30 hover:bg-transparent">
              <TableHead className="text-gray-400 font-bold text-[10px] uppercase tracking-widest pl-4">{t('account.tableHeader')}</TableHead>
              <TableHead className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Plan / Status</TableHead>
              <TableHead className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Last Login</TableHead>
              <TableHead className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">{t('admin.subscription')}</TableHead>
              <TableHead className="text-gray-400 font-bold text-[10px] uppercase tracking-widest text-right pr-4"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAccounts.length === 0 ? (
               <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-gray-500">
                     {t('admin.noAccountFound')}
                  </TableCell>
               </TableRow>
            ) : (
                filteredAccounts.map((acc, idx) => {
                    const isExpired = acc.subscriptionEnd && new Date(acc.subscriptionEnd) < new Date()
                    const isPremium = !isExpired && acc.subscriptionEnd
                    const mainChar = acc.characters.find(c => c.isMain) || acc.characters[0]

                    return (
                        <TableRow 
                            key={acc.id} 
                            className={cn(
                                "border-eve-border/20 hover:bg-eve-accent/5 transition-colors cursor-pointer group",
                                idx % 2 === 1 ? "bg-eve-dark/10" : ""
                            )}
                            onClick={() => onSelectAccount(acc)}
                        >
                            <TableCell className="pl-4 py-3">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-9 w-9 border border-eve-border/30">
                                        <AvatarImage src={mainChar ? `https://images.evetech.net/characters/${mainChar.id}/portrait?size=64` : ''} />
                                        <AvatarFallback className="bg-eve-dark text-eve-accent text-sm font-bold">
                                            {acc.name?.[0] || '?'}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-medium text-white">
                                            {acc.name || acc.accountCode || 'N/A'}
                                        </p>
                                        <p className="text-[10px] text-gray-500 font-mono">ID: {acc.accountCode || acc.id.slice(0, 8)}</p>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col gap-1">
                                    <Badge className={cn(
                                      "font-bold w-fit",
                                      isPremium ? "bg-green-500/20 text-green-500 border-green-500/50" : "bg-gray-500/20 text-gray-500 border-gray-500/50"
                                    )}>
                                      {isPremium ? t('admin.premiumTab').toUpperCase() : t('admin.free')}
                                    </Badge>
                                    <Badge variant="outline" className={cn(
                                        "text-[9px] px-1.5 py-0 border-none w-fit",
                                        acc.isBlocked ? "bg-red-500/20 text-red-500" : "bg-green-500/20 text-green-500"
                                    )}>
                                        {acc.isBlocked ? t('admin.filterBlocked').toUpperCase() : t('admin.filterActive').toUpperCase()}
                                    </Badge>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-300 font-medium whitespace-nowrap">
                                        {acc.lastLoginAt ? <FormattedDate date={acc.lastLoginAt} /> : 'Never'}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-mono">
                                        {acc.lastLoginAt ? <FormattedDate date={acc.lastLoginAt} options={{ hour: '2-digit', minute: '2-digit' }} /> : '-'}
                                    </p>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-2">
                                    <Clock className={cn("h-3 w-3", isExpired ? "text-red-500" : "text-gray-500")} />
                                    <span className={cn("text-xs font-medium", isExpired ? "text-red-400" : "text-gray-300")}>
                                        {(() => {
                                            if (!acc.subscriptionEnd) return t('admin.free')
                                            const days = getRemainingDays(acc.subscriptionEnd)
                                            if (days <= 0) return t('admin.userExpired').toUpperCase()
                                            if (days > 20000) return t('admin.lifetimeBadge')
                                            return `${days} ${t('admin.codeDuration30').split(' ')[1].toUpperCase()}`
                                        })()}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-right pr-4">
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button 
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            window.location.href = `/dashboard/admin/logs/${acc.id}`
                                        }}
                                        className="p-2 rounded-lg bg-eve-dark/50 text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                                        title={t('admin.viewErrorLogsFor').replace(
                                          '{name}',
                                          acc.name || acc.accountCode || acc.id.slice(0, 8)
                                        )}
                                        aria-label={t('admin.viewErrorLogsFor').replace(
                                          '{name}',
                                          acc.name || acc.accountCode || acc.id.slice(0, 8)
                                        )}
                                    >
                                        <Terminal className="h-4 w-4" aria-hidden />
                                    </button>
                                    <ChevronRight className="h-5 w-5 text-gray-600 group-hover:text-eve-accent group-hover:translate-x-0.5 transition-transform" />
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
