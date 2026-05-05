'use client'

import { useState } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Ban, Unlock, Trash2, RefreshCw, Shield, 
  UserCircle, Wallet, Award, Users, Zap,
  Clock, Calendar, CheckCircle2, AlertCircle,
  ExternalLink, CreditCard, Mail, MessageSquare,
  Plus, MapPin, Rocket, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { cn, formatISK } from '@/lib/utils'
import { ACTIVITY_TYPES } from '@/lib/constants/activity-data'
import { ACTIVITY_UI_MAPPING } from '@/lib/constants/activity-ui'
import { toast } from 'sonner'
import { 
  useUpdateAccount, 
  useBlockAccount, 
  useDeleteAccount,
  type AdminAccount 
} from '@/lib/admin/hooks/useAdminAccounts'
import { useUserMedals, useAwardMedal, useRevokeMedal } from '@/lib/admin/hooks/useAdminMedals'

interface AccountDetailDialogV2Props {
  account: AdminAccount | null
  isOpen: boolean
  onClose: () => void
}

export function AccountDetailDialogV2({ account, isOpen, onClose }: AccountDetailDialogV2Props) {
  const [activeTab, setActiveTab] = useState('characters')
  const [showGrantMedal, setShowGrantMedal] = useState(false)
  const updateAccount = useUpdateAccount()
  const blockAccount = useBlockAccount()
  const deleteAccount = useDeleteAccount()
  
  const { data: userMedalsData } = useUserMedals(account?.id)
  const awardMedal = useAwardMedal()
  const revokeMedal = useRevokeMedal()

  if (!account) return null

  const isPremium = account.subscriptionEnd && new Date(account.subscriptionEnd) > new Date()
  const isExpired = account.subscriptionEnd && new Date(account.subscriptionEnd) < new Date()
  const isLifetime = account.subscriptionEnd && new Date(account.subscriptionEnd).getFullYear() > 2090

  const handleRenew = async () => {
    const currentEnd = account.subscriptionEnd ? new Date(account.subscriptionEnd) : new Date()
    const baseDate = currentEnd > new Date() ? currentEnd : new Date()
    const newEndDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)

    try {
      await updateAccount.mutateAsync({ 
        userId: account.id, 
        subscriptionEnd: newEndDate.toISOString() 
      })
      toast.success(`Subscription extended to ${newEndDate.toLocaleDateString()}`)
    } catch (err) {
      toast.error('Failed to renew subscription')
    }
  }

  const handleBlock = async () => {
    try {
      await blockAccount.mutateAsync({ 
        userId: account.id, 
        isBlocked: !account.isBlocked,
        blockReason: 'Manual suspension via admin panel'
      })
      toast.success(account.isBlocked ? 'Account unblocked' : 'Account blocked')
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

  const totalLifetimeIsk = account.payments?.reduce((acc, p) => 
    acc + (p.status === 'approved' ? p.amount : 0), 0) || 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-eve-background/95 border-eve-border/30 backdrop-blur-xl p-0 overflow-hidden">
        <div className="flex h-[600px]">
          {/* Sidebar */}
          <aside className="w-64 border-r border-eve-border/30 bg-eve-panel/20 flex flex-col">
            <div className="p-6 flex flex-col items-center text-center border-b border-eve-border/30">
              <Avatar className="h-20 w-20 border-2 border-eve-accent/20 mb-3 shadow-lg">
                <AvatarImage 
                  src={account.characters?.[0] ? `https://images.evetech.net/characters/${account.characters[0].id}/portrait?size=256` : ''} 
                />
                <AvatarFallback className="bg-eve-panel text-eve-accent text-2xl font-bold">
                  {account.name?.[0] || '?'}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-eve-text truncate w-full">{account.name || 'Unknown'}</h3>
              <p className="text-[10px] font-mono text-eve-text/40 uppercase tracking-wider">
                {account.accountCode || account.id.slice(0, 8)}
              </p>
              
              <div className="mt-4 flex flex-wrap gap-1 justify-center">
                <AdminBadge status={account.isBlocked ? 'error' : 'success'}>
                  {account.isBlocked ? 'Blocked' : 'Active'}
                </AdminBadge>
                {isPremium && <AdminBadge status="warning">Premium</AdminBadge>}
                {account.isTester && <AdminBadge status="info">Tester</AdminBadge>}
              </div>
            </div>

            <div className="flex-1 p-4 space-y-6 overflow-y-auto">
              <div className="space-y-3">
                <p className="text-[10px] font-bold text-eve-text/30 uppercase tracking-widest">Metadata</p>
                <div className="space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-eve-text/40 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Seen</span>
                    <span className="text-eve-text/80">
                      {account.lastLoginAt ? <FormattedDate date={account.lastLoginAt} /> : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-eve-text/40 flex items-center gap-1.5"><Calendar className="w-3 h-3" /> Ends</span>
                    <span className={cn("text-eve-text/80 font-bold", isExpired && "text-red-400", isPremium && !isExpired && "text-green-400")}>
                      {isLifetime ? 'Lifetime' : account.subscriptionEnd ? <FormattedDate date={account.subscriptionEnd} /> : 'Free'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-eve-text/40 flex items-center gap-1.5"><Shield className="w-3 h-3" /> Discord</span>
                    <span className={cn("text-eve-text/80 truncate max-w-[80px]", account.discordId && "text-blue-400")}>
                      {account.discordName || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-2 border-t border-eve-border/10 mt-2">
                    <span className="text-eve-text/40 flex items-center gap-1.5"><Wallet className="w-3 h-3" /> Lifetime</span>
                    <span className="text-green-400 font-mono font-bold">
                      {formatISK(totalLifetimeIsk)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t border-eve-border/30">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full justify-start gap-2 h-9 border-eve-border/30 hover:bg-eve-accent/10 hover:text-eve-accent transition-all"
                  onClick={handleRenew}
                  disabled={updateAccount.isPending}
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", updateAccount.isPending && "animate-spin")} />
                  <span className="text-[11px] font-bold uppercase tracking-wider">Add 30 Days</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className={cn(
                    "w-full justify-start gap-2 h-9 border-eve-border/30 transition-all",
                    account.isBlocked ? "hover:bg-green-500/10 hover:text-green-400" : "hover:bg-red-500/10 hover:text-red-400"
                  )}
                  onClick={handleBlock}
                  disabled={blockAccount.isPending}
                >
                  {account.isBlocked ? <Unlock className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  <span className="text-[11px] font-bold uppercase tracking-wider">
                    {account.isBlocked ? 'Unblock' : 'Block'}
                  </span>
                </Button>

                {account.role !== 'master' && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-start gap-2 h-9 text-eve-text/30 hover:text-red-500 hover:bg-red-500/5 transition-all"
                    onClick={handleDelete}
                    disabled={deleteAccount.isPending}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-bold uppercase tracking-wider">Delete</span>
                  </Button>
                )}
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="flex-1 flex flex-col bg-eve-panel/10">
            <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden" onValueChange={setActiveTab}>
              <div className="px-8 pt-8 border-b border-eve-border/30 bg-eve-panel/20">
                <TabsList className="bg-transparent border-b-0 h-10 gap-6 p-0">
                  {['characters', 'permissions', 'payments', 'social', 'medals'].map((tab) => (
                    <TabsTrigger 
                      key={tab}
                      value={tab} 
                      className="data-[state=active]:bg-transparent data-[state=active]:text-eve-accent data-[state=active]:border-b-2 data-[state=active]:border-eve-accent rounded-none border-b-2 border-transparent px-0 pb-2 text-[11px] font-bold uppercase tracking-widest text-eve-text/40 transition-all"
                    >
                      {tab}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto p-8 relative">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    <TabsContent value="characters" className="mt-0 focus-visible:outline-none h-full">
                  <div className="grid grid-cols-2 gap-4">
                    {account.characters?.map((char) => (
                      <div key={char.id} className="p-3 bg-eve-panel/40 border border-eve-border/30 rounded-xl flex items-center gap-3">
                        <Avatar className="h-10 w-10 border border-eve-border/30">
                          <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
                          <AvatarFallback><UserCircle className="w-6 h-6 text-eve-text/20" /></AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold text-eve-text truncate">{char.name}</p>
                            {char.isMain && <Zap className="w-3 h-3 text-eve-accent fill-eve-accent" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-eve-text/40 font-mono">ID: {char.id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <div className="flex items-center gap-1 text-[8px] text-eve-text/30 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                              <MapPin className="w-2.5 h-2.5" />
                              <span>Synced Location</span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] text-eve-text/30 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                              <Rocket className="w-2.5 h-2.5" />
                              <span>Active Ship</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="permissions" className="mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {ACTIVITY_TYPES.map((type) => {
                      const isAllowed = account.allowedActivities?.includes(type.id)
                      const ui = ACTIVITY_UI_MAPPING[type.id as keyof typeof ACTIVITY_UI_MAPPING]
                      const Icon = ui?.icon || Shield
                      
                      return (
                        <div key={type.id} className="flex items-center justify-between p-3 bg-eve-panel/40 border border-eve-border/30 rounded-xl">
                          <div className="flex items-center gap-3">
                            <div className={cn("p-2 rounded-lg bg-black/20", isAllowed ? "text-eve-accent" : "text-eve-text/20")}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="text-xs font-medium text-eve-text">{type.label}</span>
                          </div>
                          <Switch 
                            checked={isAllowed}
                            onCheckedChange={async (checked) => {
                              const newActivities = checked 
                                ? [...(account.allowedActivities || []), type.id]
                                : (account.allowedActivities || []).filter(id => id !== type.id)
                              
                              try {
                                await updateAccount.mutateAsync({ userId: account.id, allowedActivities: newActivities })
                                toast.success(`${type.label} updated`)
                              } catch (err) {
                                toast.error('Failed to update permission')
                              }
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="payments" className="mt-0">
                  <div className="border border-eve-border/30 rounded-xl overflow-hidden">
                    <Table>
                      <TableHeader className="bg-black/20">
                        <TableRow className="border-eve-border/30 hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase font-bold text-eve-text/40 pl-4 h-10">Date</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-eve-text/40 h-10">Status</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold text-eve-text/40 text-right pr-4 h-10">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {account.payments?.map((p) => (
                          <TableRow key={p.id} className="border-eve-border/20 hover:bg-eve-accent/5 transition-colors">
                            <TableCell className="pl-4 py-3 text-[11px] text-eve-text/60 font-mono">
                              <FormattedDate date={p.createdAt} />
                            </TableCell>
                            <TableCell className="py-3">
                              <AdminBadge status={p.status === 'approved' ? 'success' : 'warning'}>
                                {p.status}
                              </AdminBadge>
                            </TableCell>
                            <TableCell className="pr-4 py-3 text-right font-mono text-xs text-green-400">
                              {formatISK(p.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {(!account.payments || account.payments.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={3} className="h-32 text-center text-eve-text/20 italic text-sm">
                              No payments recorded
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </TabsContent>

                <TabsContent value="social" className="mt-0">
                  <div className="grid grid-cols-2 gap-3">
                    {account.friends?.map((f) => (
                      <div key={f.id} className="p-3 bg-eve-panel/40 border border-eve-border/30 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center text-eve-text/40">
                          <Users className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-eve-text truncate">{f.name}</p>
                          <p className="text-[10px] text-eve-text/40">Added <FormattedDate date={f.addedAt} /></p>
                        </div>
                      </div>
                    ))}
                    {(!account.friends || account.friends.length === 0) && (
                      <div className="col-span-2 py-12 text-center text-eve-text/20 italic">
                        No social connections found
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="medals" className="mt-0">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Award className="w-5 h-5 text-eve-accent" />
                      <h4 className="text-sm font-bold text-eve-text uppercase tracking-wider">Achievement Record</h4>
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setShowGrantMedal(!showGrantMedal)}
                      className={cn(
                        "h-8 border-eve-accent/30 text-eve-accent hover:bg-eve-accent/10 gap-2 text-[10px] uppercase font-bold",
                        showGrantMedal && "bg-eve-accent/10 border-eve-accent"
                      )}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Grant Medal
                    </Button>
                  </div>

                  {showGrantMedal && (
                    <div className="mb-6 p-4 bg-eve-accent/5 border border-eve-accent/20 rounded-xl animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold text-eve-accent uppercase tracking-widest">Available Medals</p>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-eve-accent/40" onClick={() => setShowGrantMedal(false)}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {userMedalsData?.availableMedals?.map((m) => (
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
                            className="flex items-center gap-3 p-2 bg-black/20 border border-white/5 rounded-lg hover:border-eve-accent/40 hover:bg-black/40 transition-all text-left group"
                          >
                            <span className="text-xl">{m.icon}</span>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-eve-text truncate group-hover:text-eve-accent">{m.name}</p>
                              <p className="text-[9px] text-eve-text/40 uppercase font-mono">{m.tier}</p>
                            </div>
                          </button>
                        ))}
                        {(!userMedalsData?.availableMedals || userMedalsData.availableMedals.length === 0) && (
                          <p className="col-span-2 text-center py-4 text-xs text-eve-text/20">No more medals available to award</p>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    {(userMedalsData?.awardedMedals || account.medals)?.map((m: any) => (
                      <div key={m.id} className="p-3 bg-eve-panel/40 border border-eve-border/30 rounded-xl flex items-center gap-4 relative group overflow-hidden transition-all hover:border-eve-accent/20">
                        <div className="w-12 h-12 bg-black/40 rounded-lg flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                          {m.medal?.icon || m.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-eve-text truncate">{m.medal?.name || m.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] text-eve-accent uppercase font-mono">{m.medal?.tier || m.tier}</span>
                            <span className="text-[9px] text-eve-text/40"><FormattedDate date={m.awardedAt} /></span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          onClick={async () => {
                            if (!confirm('Revoke this medal?')) return
                            try {
                              await revokeMedal.mutateAsync({ userId: account.id, awardId: m.id })
                              toast.success('Medal revoked')
                            } catch {
                              toast.error('Failed to revoke medal')
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                    {(!account.medals || account.medals.length === 0) && (
                      <div className="col-span-2 py-12 text-center text-eve-text/20 italic">
                        <Award className="w-12 h-12 mx-auto mb-3 opacity-10" />
                        No medals awarded
                      </div>
                    )}
                  </div>
                    </TabsContent>
                  </motion.div>
                </AnimatePresence>
              </div>
            </Tabs>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  )
}
