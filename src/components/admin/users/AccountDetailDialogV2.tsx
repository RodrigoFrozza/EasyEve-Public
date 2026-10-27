import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { 
  UserCircle, 
  Trash2, 
  Ban, 
  Unlock, 
  Zap, 
  Wallet, 
  Shield, 
  Award, 
  Plus, 
  X, 
  Gift, 
  Clock, 
  Calendar, 
  Users 
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatISK } from '@/lib/utils'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'

interface AccountDetailDialogV2Props {
  isOpen: boolean
  onClose: () => void
  account: any
}

export function AccountDetailDialogV2({ isOpen, onClose, account }: AccountDetailDialogV2Props) {
  const { t } = useTranslations()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('characters')
  const [showGrantMedal, setShowGrantMedal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [creditDays, setCreditDays] = useState('30')
  const [creditType, setCreditType] = useState('Premium')
  const [isCrediting, setIsCrediting] = useState(false)

  // Queries & Mutations
  const { data: userMedalsData } = useQuery({
    queryKey: ['admin-user-medals', account?.id],
    queryFn: async () => {
      const res = await fetch(`/api/admin/medals/${account?.id}`)
      if (!res.ok) throw new Error('Failed to fetch medals')
      return res.json()
    },
    enabled: !!account?.id
  })

  const blockAccount = useMutation({
    mutationFn: async (blocked: boolean) => {
      const res = await fetch(`/api/admin/accounts/${account.id}/block`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isBlocked: blocked })
      })
      if (!res.ok) throw new Error('Failed to update status')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      toast.success(account?.isBlocked ? 'Account unblocked' : 'Account blocked')
    }
  })

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/accounts?userId=${encodeURIComponent(id)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete account')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
      onClose()
    }
  })

  const awardMedal = useMutation({
    mutationFn: async (data: { userId: string, medalId: string }) => {
      const res = await fetch(`/api/admin/medals/${data.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ medalId: data.medalId })
      })
      if (!res.ok) throw new Error('Failed to award medal')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-medals', account?.id] })
    }
  })

  const revokeMedal = useMutation({
    mutationFn: async (data: { userId: string, awardId: string }) => {
      const res = await fetch(
        `/api/admin/medals/${data.userId}?awardId=${encodeURIComponent(data.awardId)}`,
        { method: 'DELETE' }
      )
      if (!res.ok) throw new Error('Failed to revoke medal')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-user-medals', account?.id] })
    }
  })

  const handleCredit = async () => {
    setIsCrediting(true)
    try {
      const res = await fetch('/api/admin/accounts/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: account.id,
          days: parseInt(creditDays, 10),
          type: creditType,
        }),
      })
      
      if (!res.ok) throw new Error('Failed to credit account')
      
      toast.success('Account credited successfully')
      setShowCreditModal(false)
      queryClient.invalidateQueries({ queryKey: ['admin-accounts'] })
    } catch (err) {
      toast.error('Failed to credit account')
    } finally {
      setIsCrediting(false)
    }
  }

  const handleBlock = async () => {
    try {
      await blockAccount.mutateAsync(!account.isBlocked)
    } catch (err) {
      toast.error('Failed to change account status')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you absolutely sure? This will permanently delete all account data.')) return
    try {
      await deleteAccount.mutateAsync(account.id)
      toast.success('Account deleted successfully')
      onClose()
    } catch (err) {
      toast.error('Failed to delete account')
    }
  }

  if (!account) return null

  const isPremium = account.subscriptionEnd && new Date(account.subscriptionEnd) > new Date()
  const isExpired = account.subscriptionEnd && new Date(account.subscriptionEnd) < new Date()
  const isLifetime = account.subscriptionEnd && new Date(account.subscriptionEnd).getFullYear() > 2099

  const totalLifetimeIsk = account.payments?.reduce((acc: number, p: any) => 
    acc + (p.status === 'approved' ? p.amount : 0), 0) || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-ta-sidebar border border-white/[0.08] p-0 overflow-hidden rounded-[18px] shadow-[0_30px_80px_rgba(0,0,0,.55)] text-ta-body font-sans">
        <div className="flex h-[650px]">
          {/* Sidebar */}
          <aside className="w-80 border-r border-white/[0.06] bg-gradient-to-b from-[#0e1720] to-[#0a1017] flex flex-col relative overflow-hidden">
            {/* Background Glow */}
            
            <div className="p-8 flex flex-col items-center text-center border-b border-white/[0.06] relative z-10">
              <div className="relative group">
                <Avatar className="h-28 w-28 border border-white/10 rounded-[16px] overflow-hidden">
                  <AvatarImage 
                    className="transition-all duration-700 group-hover:rotate-3"
                    src={account.characters?.[0] ? `https://images.evetech.net/characters/${account.characters[0].id}/portrait?size=256` : ''} 
                  />
                  <AvatarFallback className="bg-gradient-to-br from-[#1c2a3a] to-[#0e1822] text-ta-secondary text-3xl font-bold">
                    {account.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 p-1.5 bg-background border border-white/[0.06] rounded-xl shadow-lg">
                  <UserCircle className="w-5 h-5 text-primary" />
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground truncate w-full mt-6">{account.name || t('admin.noName')}</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {t('admin.accountDetail.accountCode')}: {account.accountCode || account.id.slice(0, 8)}
              </p>
              
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <AdminBadge status={account.isBlocked ? 'error' : 'success'}>
                  {account.isBlocked ? t('admin.filterBlocked') : t('admin.filterActive')}
                </AdminBadge>
                {isPremium && <AdminBadge status="warning">{t('admin.premiumTab')}</AdminBadge>}
                {account.isTester && <AdminBadge status="info">Tester</AdminBadge>}
              </div>
            </div>

            <div className="flex-1 p-8 space-y-10 overflow-y-auto relative z-10">
              <div className="space-y-5">
                <p className="text-xs font-medium text-muted-foreground">{t('admin.accountDetail.lastActive')}</p>
                <div className="space-y-3 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t('admin.lastLogin')}
                    </span>
                    <span className="text-xs font-black text-foreground tracking-tight">
                      {account.lastLoginAt ? <FormattedDate date={account.lastLoginAt} /> : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                      {t('admin.accountDetail.subscriptionEnds')}
                    </span>
                    <span className={cn('text-sm', isExpired ? 'text-destructive' : 'text-foreground')}>
                      {isLifetime ? t('admin.lifetime') : account.subscriptionEnd ? <FormattedDate date={account.subscriptionEnd} /> : t('admin.accountDetail.inactive')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">{t('admin.accountDetail.totalPayments')}</p>
                <div className="p-4 rounded-[10px] border border-white/[0.06] bg-ta-inset">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Wallet className="w-4 h-4" />
                  </div>
                  <p className="text-2xl font-black text-foreground tabular-nums tracking-tighter">{formatISK(totalLifetimeIsk)}</p>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-4 h-12 border-white/[0.08] bg-ta-inset hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all duration-300 rounded-xl text-xs font-black uppercase tracking-widest group shadow-sm"
                  onClick={() => setShowCreditModal(true)}
                >
                  <div className="p-1.5 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                    <Gift className="w-4 h-4 text-primary" />
                  </div>
                  {t('admin.grantPremium')}
                </Button>
                
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start gap-4 h-12 border-white/[0.08] bg-ta-inset transition-all duration-300 rounded-xl text-xs font-black uppercase tracking-widest group shadow-sm",
                    account.isBlocked 
                      ? "hover:bg-emerald-500/5 hover:text-emerald-500 hover:border-emerald-500/20" 
                      : "hover:bg-rose-500/5 hover:text-rose-500 hover:border-rose-500/20"
                  )}
                  onClick={handleBlock}
                  disabled={blockAccount.isPending}
                >
                  <div className={cn(
                    "p-1.5 rounded-lg transition-colors",
                    account.isBlocked ? "bg-emerald-500/10 group-hover:bg-emerald-500/20" : "bg-rose-500/10 group-hover:bg-rose-500/20"
                  )}>
                    {account.isBlocked ? <Unlock className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                  </div>
                  {account.isBlocked ? t('admin.unblock') : t('admin.block')}
                </Button>

                {account.role !== 'master' && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-4 h-12 text-ta-muted hover:text-rose-500 hover:bg-rose-500/5 transition-all duration-300 rounded-xl text-xs font-black uppercase tracking-widest group"
                    onClick={handleDelete}
                    disabled={deleteAccount.isPending}
                  >
                    <div className="p-1.5 rounded-lg bg-muted group-hover:bg-rose-500/10 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </div>
                    {t('admin.delete')}
                  </Button>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col bg-transparent">
            <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden" onValueChange={setActiveTab}>
              <div className="px-10 pt-8 border-b border-white/[0.06] bg-ta-header">
                <TabsList className="bg-transparent border-b-0 h-14 gap-10 p-0">
                  {[
                    { id: 'characters', label: t('admin.accountDetail.tabCharacters'), icon: Users },
                    { id: 'payments', label: t('admin.accountDetail.tabPayments'), icon: Wallet },
                    { id: 'social', label: t('admin.accountDetail.tabSocial'), icon: Shield },
                    { id: 'medals', label: t('admin.accountDetail.tabMedals'), icon: Award }
                  ].map((tab) => (
                    <TabsTrigger 
                      key={tab.id}
                      value={tab.id} 
                      className="data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none border-b-2 border-transparent px-0 pb-4 text-xs font-black uppercase tracking-[0.2em] text-ta-muted transition-all hover:text-foreground group"
                    >
                      <div className="flex items-center gap-2.5">
                        <tab.icon className="w-4 h-4 transition-transform group-hover:scale-110" />
                        {tab.label}
                      </div>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-10 relative">
                {/* Decorative background element */}

                <TabsContent value="characters" className="mt-0 focus-visible:outline-none h-full animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-2 gap-5">
                    {account.characters?.map((char: any) => (
                      <div key={char.id} className="p-5 bg-ta-inset border border-white/[0.06] rounded-[12px] flex items-center gap-5 transition-all duration-500 hover:border-eve-accent/40 group relative overflow-hidden">
                        <Avatar className="h-14 w-14 border-2 border-background shadow-lg rounded-[10px] overflow-hidden relative z-10">
                          <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
                          <AvatarFallback className="rounded-xl bg-muted"><UserCircle className="w-8 h-8 text-ta-faint" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 relative z-10">
                          <div className="flex items-center justify-between">
                            <p className="font-accent text-[14px] font-semibold text-ta-bright truncate group-hover:text-eve-accent">{char.name}</p>
                            {char.isMain && <Zap className="w-4 h-4 text-amber-500 fill-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="text-[10px] text-ta-faint font-black uppercase tracking-widest bg-white/[0.04] px-2 py-0.5 rounded-md">ID: {char.id}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="border border-white/[0.06] rounded-[12px] overflow-hidden bg-ta-inset">
                    <Table>
                      <TableHeader className="bg-ta-header">
                        <TableRow className="border-white/[0.06] hover:bg-transparent">
                          <TableHead className="pl-6">{t('admin.dateTime')}</TableHead>
                          <TableHead>{t('admin.status')}</TableHead>
                          <TableHead className="text-right pr-6">{t('admin.value')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {account.payments?.map((p: any) => (
                          <TableRow key={p.id} className="border-white/[0.05] hover:bg-primary/[0.02] transition-colors group">
                            <TableCell className="pl-6 py-5 text-[11px] font-bold text-foreground/80 border-r border-white/[0.04]">
                              <FormattedDate date={p.createdAt} />
                            </TableCell>
                            <TableCell className="py-5 border-r border-white/[0.04]">
                              <AdminBadge status={p.status === 'approved' ? 'success' : 'warning'}>
                                {p.status}
                              </AdminBadge>
                            </TableCell>
                            <TableCell className="pr-6 py-5 text-right font-black text-sm text-foreground tabular-nums tracking-tighter group-hover:text-primary transition-colors">
                              {formatISK(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!account.payments || account.payments.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="h-40 text-center">
                              <div className="flex flex-col items-center gap-2 opacity-30">
                                <Wallet className="w-8 h-8 mb-2" />
                                <p className="text-sm text-muted-foreground">{t('admin.accountDetail.noPayments')}</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="grid grid-cols-2 gap-5">
                    {account.friends?.map((f: any) => (
                      <div key={f.id} className="p-5 bg-ta-inset border border-white/[0.06] rounded-[12px] flex items-center gap-5 hover:border-eve-accent/40 transition-all duration-500 relative group overflow-hidden">
                        <div className="w-14 h-14 rounded-xl bg-white/[0.04] flex items-center justify-center text-ta-faint border border-white/[0.06] transition-all group-hover:scale-110 duration-500 relative z-10 shadow-inner">
                          <Users className="w-7 h-7" />
                        </div>
                        <div className="min-w-0 relative z-10">
                          <p className="font-accent text-[14px] font-semibold text-ta-bright truncate group-hover:text-eve-accent">{f.name}</p>
                          <p className="text-[10px] text-ta-faint uppercase tracking-widest mt-1.5 font-black bg-white/[0.04] px-2 py-0.5 rounded-md inline-block">NODE CONNECTED</p>
                        </div>
                      </div>
                    ))}
                    {(!account.friends || account.friends.length === 0) && (
                      <div className="col-span-2 py-24 text-center border border-dashed border-white/[0.06] rounded-[16px] bg-white/[0.02] flex flex-col items-center gap-4 opacity-30">
                        <Users className="w-12 h-12" />
                        <p className="text-[11px] font-black uppercase tracking-[0.2em]">No External Networks Identified</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="medals" className="mt-0 animate-in fade-in slide-in-from-right-4 duration-500">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-primary/10 text-primary">
                        <Award className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-black text-foreground uppercase tracking-widest">Protocol Awards</h4>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowGrantMedal(!showGrantMedal)}
                      className={cn(
                        "h-10 px-5 border-white/[0.08] bg-ta-inset gap-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 shadow-sm",
                        showGrantMedal && "bg-primary/10 text-primary border-primary/30 ring-1 ring-primary/20"
                      )}
                    >
                      <Plus className="w-4 h-4" />
                      Issue Award
                    </Button>
                  </div>

                  {showGrantMedal && (
                    <div className="mb-10 p-8 bg-ta-inset border border-eve-accent/30 rounded-[14px] relative overflow-hidden">
                      <div className="flex items-center justify-between mb-6 relative z-10">
                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Available Certificates</p>
                        <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all" onClick={() => setShowGrantMedal(false)}>
                          <X className="w-5 h-5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-4 relative z-10">
                        {userMedalsData?.availableMedals?.map((m: any) => (
                          <button
                            key={m.id}
                            onClick={async () => {
                              try {
                                await awardMedal.mutateAsync({ userId: account.id, medalId: m.id })
                                toast.success(`Awarded ${m.name}`)
                              } catch {
                                toast.error('Failed to award medal')
                              }
                            }}
                            className="flex items-center gap-5 p-4 bg-ta-inset border border-white/[0.06] rounded-[12px] hover:border-eve-accent/40 transition-colors text-left group"
                          >
                            <div className="text-3xl transition-transform duration-500 group-hover:scale-125 filter drop-shadow-[0_0_10px_rgba(255,255,255,0.1)]">{m.icon}</div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-foreground truncate group-hover:text-primary transition-colors">{m.name}</p>
                              <p className="text-[9px] text-ta-muted uppercase tracking-[0.2em] font-black mt-1">{m.tier}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-5">
                    {(userMedalsData?.awardedMedals || account.medals)?.map((m: any) => (
                      <div key={m.id} className="p-5 bg-ta-inset border border-white/[0.06] rounded-[12px] flex items-center gap-5 relative group transition-all duration-500 hover:border-eve-accent/30 overflow-hidden">
                        <div className="w-16 h-16 bg-white/[0.04] rounded-xl border border-white/[0.06] flex items-center justify-center text-4xl group-hover:scale-110 duration-700 transition-transform relative z-10 shadow-inner">
                          {m.medal?.icon || m.icon}
                        </div>
                        <div className="flex-1 min-w-0 relative z-10">
                          <p className="font-accent text-[14px] font-semibold text-ta-bright truncate group-hover:text-eve-accent">{m.medal?.name || m.name}</p>
                          <div className="flex flex-col mt-1.5 gap-1">
                            <span className="text-[9px] text-primary font-black uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded-md self-start">{m.medal?.tier || m.tier}</span>
                            <span className="text-[9px] text-ta-faint font-black uppercase tracking-[0.1em]">ISSUED: <FormattedDate date={m.awardedAt} /></span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 opacity-0 group-hover:opacity-100 transition-all text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl absolute top-3 right-3 z-20"
                          onClick={async () => {
                            if (!confirm('Revoke this award from pilot history?')) return
                            try {
                                await revokeMedal.mutateAsync({ userId: account.id, awardId: m.id })
                                toast.success('Award successfully revoked')
                            } catch {
                                toast.error('Failed to revoke award')
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    {(!account.medals || account.medals.length === 0) && (
                      <div className="col-span-2 py-24 text-center border border-dashed border-white/[0.06] rounded-[16px] bg-white/[0.02] flex flex-col items-center gap-5 opacity-30">
                        <Award className="w-14 h-14 text-muted-foreground" />
                        <p className="text-[11px] font-black uppercase tracking-[0.2em]">No Award History Identified</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </div>
            </Tabs>
          </main>
        </div>

        {/* Credit Modal Overlay */}
        {showCreditModal && (
          <div className="fixed inset-0 bg-[rgba(2,6,11,.92)] flex items-center justify-center z-[110] animate-in fade-in duration-300">
            <div className="bg-ta-sidebar border border-white/[0.08] rounded-[18px] p-8 w-full max-w-sm space-y-8 shadow-[0_30px_80px_rgba(0,0,0,.55)] font-sans relative overflow-hidden">
              {/* Background Accent */}
              
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-5">
                  <div className="p-4 bg-eve-accent/[0.1] rounded-[12px] text-eve-accent border border-eve-accent/20">
                    <Gift className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-foreground leading-tight tracking-tight uppercase">Protocol Grant</h3>
                    <p className="text-[10px] font-black text-ta-muted mt-1 uppercase tracking-widest">Manual Override</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowCreditModal(false)} className="text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-full transition-all h-10 w-10 p-0">
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-8 relative z-10">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Access Protocol</label>
                  <div className="grid grid-cols-3 gap-3">
                    {['Premium', 'PL8R', 'Promo_code'].map((t) => (
                      <button
                        key={t}
                        onClick={() => setCreditType(t)}
                        className={cn(
                          "px-3 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-300 border shadow-sm",
                          creditType === t 
                            ? "bg-eve-accent/[0.12] border-eve-accent/[0.24] text-eve-accent" 
                            : "bg-ta-inset border-white/[0.08] text-ta-secondary hover:border-eve-accent/40 hover:text-white"
                        )}
                      >
                        {t === 'Promo_code' ? 'Promo' : t}
                      </button>
                    ))}
                  </div>
                </div>

                {creditType !== 'PL8R' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] ml-1">Time Delta (Days)</label>
                    <div className="grid grid-cols-5 gap-2">
                      {['7', '15', '30', '60', '90'].map((d) => (
                        <button
                          key={d}
                          onClick={() => setCreditDays(d)}
                          className={cn(
                            "py-3 rounded-xl text-[10px] font-black transition-all duration-300 border shadow-sm",
                            creditDays === d 
                              ? "bg-eve-accent/[0.12] border-eve-accent/[0.24] text-eve-accent" 
                              : "bg-ta-inset border-white/[0.08] text-ta-secondary hover:border-eve-accent/40 hover:text-white"
                          )}
                        >
                          {d}D
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button 
                className="w-full ta-cta font-accent font-bold uppercase tracking-[0.2em] h-14 rounded-[12px] relative z-10 text-xs overflow-hidden group"
                onClick={handleCredit}
                disabled={isCrediting}
              >
                <div className="absolute inset-0 bg-white/20 scale-x-0 group-hover:scale-x-100 transition-transform duration-700 origin-left" />
                <span className="relative z-10 flex items-center gap-2 justify-center">
                  {isCrediting ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      SYNCHRONIZING...
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4" />
                      EXECUTE GRANT
                    </>
                  )}
                </span>
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
