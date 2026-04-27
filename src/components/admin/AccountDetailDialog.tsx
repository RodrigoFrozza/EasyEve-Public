'use client'
import { useState, useEffect } from 'react'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Loader2, Ban, Unlock, Trash2, Zap, 
  Shield, UserCircle, Wallet, MapPin, Rocket, RefreshCw, History,
  Award, Users, Plus, Database, Clock, Calendar, CheckCircle2, AlertCircle
} from 'lucide-react'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import { cn, formatISK } from '@/lib/utils'
import { ACTIVITY_TYPES } from '@/lib/constants/activity-data'
import { useTranslations } from '@/i18n/hooks'
import { ACTIVITY_UI_MAPPING } from '@/lib/constants/activity-ui'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface Character {
  id: number
  name: string
  isMain: boolean
}

interface MedalInfo {
  id: string
  name: string
  icon: string
  tier: string
  count: number
  awardedAt: string
}

interface FriendInfo {
  id: string
  name: string
  addedAt: string
}

interface AccountData {
  id: string
  accountCode: string | null
  name: string | null
  role: string
  isBlocked: boolean
  subscriptionEnd: string | null
  lastLoginAt: string | null
  discordId: string | null
  discordName: string | null
  allowedActivities: string[]
  characters: Character[]
  payments?: Array<{
    id: string
    amount: number
    status: string
    createdAt: string
    payerCharacterName: string | null
    journalId: string | null
  }>
  medals?: MedalInfo[]
  friends?: FriendInfo[]
}

interface AccountDetailDialogProps {
  account: AccountData | null
  isOpen: boolean
  onClose: () => void
  onRefresh: () => void
}

export function AccountDetailDialog({ account, isOpen, onClose, onRefresh }: AccountDetailDialogProps) {
  const { t } = useTranslations()
  const [saving, setSaving] = useState<string | null>(null)

  if (!account) return null

  const isPremium = account.subscriptionEnd && new Date(account.subscriptionEnd) > new Date()
  const isExpired = account.subscriptionEnd && new Date(account.subscriptionEnd) < new Date()

  const handleBlock = async () => {
    setSaving('blocking')
    try {
      const res = await fetch(`/api/admin/accounts/${account.id}/block`, {
        method: 'PUT',
        body: JSON.stringify({ isBlocked: !account.isBlocked, blockReason: 'Manual suspension via admin panel' })
      })
      if (res.ok) {
        toast.success(t(account.isBlocked ? 'admin.accountUnblocked' : 'admin.accountBlocked'))
        onRefresh()
      }
    } catch (err) {
      toast.error(t('admin.accountStatusError'))
    } finally {
      setSaving(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`ARE YOU SURE? This action is IRREVERSIBLE. All account data will be permanently deleted.`)) return
    
    setSaving('deleting')
    try {
      const res = await fetch(`/api/admin/accounts?userId=${account.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success(t('admin.accountDeleted'))
        onRefresh()
        onClose()
      }
    } catch (err) {
      toast.error(t('admin.deleteError'))
    } finally {
      setSaving(null)
    }
  }

  const handleRenew = async () => {
    setSaving('renewing')
    try {
      const currentEnd = account.subscriptionEnd ? new Date(account.subscriptionEnd) : new Date()
      const baseDate = currentEnd > new Date() ? currentEnd : new Date()
      const newEndDate = new Date(baseDate.getTime() + 30 * 24 * 60 * 60 * 1000)

      const res = await fetch('/api/admin/accounts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: account.id, subscriptionEnd: newEndDate.toISOString() })
      })

      if (res.ok) {
        toast.success(`${t('admin.subscriptionRenewed')} ${newEndDate.toLocaleDateString()}`)
        onRefresh()
      }
    } catch (err) {
      toast.error(t('admin.renewError'))
    } finally {
      setSaving(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl bg-[#0a0a0f]/95 border-eve-border text-white p-0 overflow-hidden shadow-2xl shadow-black/50 backdrop-blur-xl">
        <DialogTitle className="sr-only">Account Details - {account.name || account.accountCode}</DialogTitle>
        <DialogDescription className="sr-only">Administrative view for account {account.id}</DialogDescription>
        
        <div className="flex flex-col md:flex-row h-[85vh] md:h-[700px]">
          {/* LEFT SIDEBAR - PROFILE & ACTIONS */}
          <aside className="w-full md:w-80 bg-eve-panel/50 border-r border-eve-border flex flex-col shrink-0 overflow-y-auto custom-scrollbar">
            {/* Character Header Backdrop */}
            <div className="relative h-48 bg-gradient-to-b from-eve-accent/10 to-transparent flex items-center justify-center p-6">
              <div className="absolute inset-0 overflow-hidden opacity-30 pointer-events-none">
                <div className="absolute inset-0 bg-[url('/og-image.svg')] bg-cover bg-center animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#12121a] via-transparent to-transparent" />
                {/* Scanline Effect */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-eve-accent/5 to-transparent h-1 w-full animate-scanline" />
              </div>
              
              <div className="relative group">
                <div className="absolute -inset-2 bg-gradient-to-r from-eve-accent to-blue-600 rounded-full blur opacity-10 group-hover:opacity-30 transition duration-1000 group-hover:duration-200"></div>
                <Avatar className="h-32 w-32 border-2 border-eve-accent/20 shadow-2xl relative bg-eve-dark">
                  <AvatarImage 
                    src={account.characters?.[0] ? `https://images.evetech.net/characters/${account.characters[0].id}/portrait?size=256` : ''} 
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-eve-dark text-eve-accent text-4xl font-bold font-outfit">
                    {account.name?.[0] || '?'}
                  </AvatarFallback>
                </Avatar>
                {account.isBlocked && (
                  <div className="absolute -bottom-1 -right-1 bg-red-600 text-white p-2 rounded-full shadow-lg border-2 border-[#12121a] z-10">
                    <Ban className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="px-6 py-4 space-y-6 flex-1">
              <div className="text-center space-y-1">
                <h2 className="text-xl font-bold tracking-tight text-white font-outfit truncate">{account.name || t('admin.noName')}</h2>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] font-mono text-eve-accent uppercase tracking-wider opacity-70">
                    {account.accountCode || account.id.slice(0, 8)}
                  </span>
                  {account.role === 'master' && (
                    <Badge className="bg-eve-accent text-black text-[9px] font-bold h-4 px-2 leading-none border-none">ADMIN</Badge>
                  )}
                </div>
              </div>

              {/* Status Pills */}
              <div className="flex flex-wrap gap-2 justify-center">
                <Badge className={cn(
                  "font-bold text-[10px] px-2 py-0.5 border-none",
                  isPremium ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-400"
                )}>
                  {isPremium ? t('admin.premiumTab').toUpperCase() : t('admin.free')}
                </Badge>
                {account.isBlocked && (
                  <Badge variant="destructive" className="text-[10px] px-2 py-0.5 uppercase border-none">
                    {t('common.blocked')}
                  </Badge>
                )}
              </div>

              {/* Quick Details List */}
              <div className="space-y-3 pt-6 border-t border-eve-border/30">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" /> Last Seen
                  </span>
                  <span className="text-gray-300 font-medium">
                    {account.lastLoginAt ? <FormattedDate date={account.lastLoginAt} options={{ month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }} /> : 'Never'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" /> Expiration
                  </span>
                  <span className={cn("font-medium", isExpired ? "text-red-400" : "text-green-400")}>
                    {(() => {
                        if (!account.subscriptionEnd) return t('admin.free')
                        const end = new Date(account.subscriptionEnd)
                        if (end.getFullYear() > 2090) return t('admin.lifetimeBadge')
                        return <FormattedDate date={account.subscriptionEnd} />
                    })()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-500 flex items-center gap-2">
                    <Shield className="h-3.5 w-3.5" /> Discord
                  </span>
                  <span className={cn("font-medium truncate max-w-[120px]", account.discordId ? "text-blue-400" : "text-gray-600")}>
                    {account.discordName || t('admin.notLinked')}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-6 space-y-2">
                <Button 
                  variant="outline" 
                  className={cn(
                    "w-full justify-start gap-3 h-11 border-eve-border/50 bg-black/20 transition-all",
                    account.isBlocked ? "text-green-400 hover:text-green-300 hover:bg-green-400/5 hover:border-green-400/30" : "text-red-400 hover:text-red-300 hover:bg-red-400/5 hover:border-red-400/30"
                  )}
                  onClick={handleBlock}
                  disabled={!!saving}
                >
                  {saving === 'blocking' ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                    account.isBlocked ? <Unlock className="h-4 w-4" /> : <Ban className="h-4 w-4" />
                  )}
                  <span className="text-xs font-bold uppercase tracking-wider">{account.isBlocked ? t('admin.unblock') : t('admin.block')}</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-3 h-11 border-eve-border/50 bg-black/20 text-eve-accent hover:bg-eve-accent/5 hover:border-eve-accent/30 transition-all"
                  onClick={handleRenew}
                  disabled={!!saving}
                >
                  {saving === 'renewing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  <span className="text-xs font-bold uppercase tracking-wider">{t('admin.add30DaysButton')}</span>
                </Button>

                {account.role !== 'master' && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start gap-3 h-11 text-gray-500 hover:text-red-500 hover:bg-red-500/5 transition-all"
                    onClick={handleDelete}
                    disabled={!!saving}
                  >
                    {saving === 'deleting' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="text-xs font-bold uppercase tracking-wider">{t('admin.delete')}</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Footer Sidebar */}
            <div className="p-4 mt-auto border-t border-eve-border/20">
              <Button variant="ghost" className="w-full text-gray-500 hover:text-white text-[10px] h-8 uppercase tracking-widest font-bold" onClick={onClose}>
                {t('admin.close')}
              </Button>
            </div>
          </aside>

          {/* RIGHT CONTENT AREA - TABS */}
          <main className="flex-1 flex flex-col min-w-0 relative">
            <Tabs defaultValue="characters" className="flex-1 flex flex-col overflow-hidden">
              <div className="px-8 pt-8 pb-4 border-b border-eve-border/30 bg-black/20">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none">Management Console</p>
                    <h3 className="text-lg font-bold text-white font-outfit">Detailed Account Overview</h3>
                  </div>
                  
                  {/* Quick Stats Header */}
                  <div className="hidden lg:flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest leading-none mb-1">Total Lifetime ISK</p>
                      <p className="text-sm font-mono text-green-400 font-bold">
                        {formatISK(account.payments?.reduce((acc, p) => acc + (p.status === 'approved' ? p.amount : 0), 0) || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <TabsList className="bg-eve-dark/60 border border-eve-border/50 p-1 h-11">
                  <TabsTrigger value="characters" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black text-[11px] px-5 transition-all duration-300 font-bold uppercase tracking-wider">
                    Characters ({account.characters?.length || 0})
                  </TabsTrigger>
                  <TabsTrigger value="modules" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black text-[11px] px-5 transition-all duration-300 font-bold uppercase tracking-wider">
                    Modules
                  </TabsTrigger>
                  <TabsTrigger value="payments" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black text-[11px] px-5 transition-all duration-300 font-bold uppercase tracking-wider">
                    Payments
                  </TabsTrigger>
                  <TabsTrigger value="social" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black text-[11px] px-5 transition-all duration-300 font-bold uppercase tracking-wider">
                    Social
                  </TabsTrigger>
                  <TabsTrigger value="medals" className="data-[state=active]:bg-eve-accent data-[state=active]:text-black text-[11px] px-5 transition-all duration-300 font-bold uppercase tracking-wider">
                    Medals
                  </TabsTrigger>
                </TabsList>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                <AnimatePresence mode="wait">
                  {/* CHARACTERS TAB */}
                  <TabsContent value="characters" className="mt-0 outline-none">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid grid-cols-1 xl:grid-cols-2 gap-4"
                    >
                      {account.characters?.map((char) => (
                        <div key={char.id} className="group relative p-4 rounded-xl bg-eve-panel/40 border border-eve-border/40 hover:border-eve-accent/30 transition-all duration-500 overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-eve-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          
                          <div className="flex items-center gap-4 relative z-10">
                            <div className="relative">
                              <Avatar className="h-16 w-16 border border-eve-border group-hover:border-eve-accent/50 transition-colors shadow-lg">
                                <AvatarImage src={`https://images.evetech.net/characters/${char.id}/portrait?size=128`} />
                                <AvatarFallback><UserCircle className="h-8 w-8 text-gray-600" /></AvatarFallback>
                              </Avatar>
                              {char.isMain && (
                                <div className="absolute -top-1 -left-1 bg-eve-accent text-black rounded-full p-1 shadow-lg">
                                  <Zap className="h-3 w-3 fill-black" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <p className="text-sm font-bold text-white group-hover:text-eve-accent transition-colors truncate">{char.name}</p>
                                {char.isMain && <Badge className="text-[8px] h-3.5 px-1.5 leading-none bg-eve-accent/10 text-eve-accent border-none font-bold">MAIN</Badge>}
                              </div>
                              <p className="text-[10px] text-gray-500 font-mono mt-0.5 flex items-center gap-2">
                                <span>EVE ID: {char.id}</span>
                                <span className="w-1 h-1 rounded-full bg-gray-800" />
                                <span className="text-emerald-500/70">Authenticated</span>
                              </p>
                              
                              <div className="flex items-center gap-3 mt-3">
                                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                  <MapPin className="h-3 w-3 text-gray-600" />
                                  <span>Synced Location</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[9px] text-gray-400 bg-black/40 px-2 py-0.5 rounded border border-white/5">
                                  <Rocket className="h-3 w-3 text-gray-600" />
                                  <span>Active Ship</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                      {(!account.characters || account.characters.length === 0) && (
                        <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-600 border-2 border-dashed border-eve-border/10 rounded-2xl">
                          <UserCircle className="h-16 w-16 mb-4 opacity-10" />
                          <p className="font-outfit text-sm tracking-wide">No characters linked to this account</p>
                        </div>
                      )}
                    </motion.div>
                  </TabsContent>

                  {/* MODULES TAB */}
                  <TabsContent value="modules" className="mt-0 outline-none">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between bg-eve-accent/5 border border-eve-accent/20 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <Shield className="h-6 w-6 text-eve-accent" />
                          <div>
                            <h3 className="text-sm font-bold text-white font-outfit leading-tight">Module Permissions</h3>
                            <p className="text-[11px] text-gray-500">Configure feature access for this specific user account.</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="border-eve-accent/30 text-eve-accent font-mono">
                          {account.allowedActivities?.length || 0} / {ACTIVITY_TYPES.length}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {ACTIVITY_TYPES.map((type) => {
                          const isAllowed = account.allowedActivities?.includes(type.id)
                          const ui = ACTIVITY_UI_MAPPING[type.id as keyof typeof ACTIVITY_UI_MAPPING]
                          const Icon = ui?.icon || (type.id === 'market' ? Database : Rocket)
                          
                          return (
                            <div 
                              key={type.id} 
                              className={cn(
                                "relative flex items-center justify-between p-4 rounded-xl border transition-all duration-300 group overflow-hidden",
                                isAllowed 
                                  ? "bg-eve-accent/[0.03] border-eve-accent/20 shadow-lg" 
                                  : "bg-eve-panel/20 border-eve-border/40 opacity-50 grayscale hover:grayscale-0 hover:opacity-80"
                              )}
                            >
                              <div className="flex items-center gap-3 relative z-10">
                                <div className={cn(
                                  "p-2.5 rounded-lg transition-all duration-300 group-hover:scale-110 shadow-inner",
                                  isAllowed ? ui?.bg || "bg-eve-accent/10" : "bg-gray-900/50"
                                )}>
                                  <Icon className={cn("h-5 w-5", isAllowed ? ui?.color || "text-eve-accent" : "text-gray-600")} />
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-white block leading-none mb-1">{type.label}</span>
                                  <Badge className={cn(
                                    "text-[8px] h-3 px-1 border-none font-bold uppercase",
                                    isAllowed ? "bg-green-500/10 text-green-500" : "bg-gray-500/10 text-gray-500"
                                  )}>
                                    {isAllowed ? 'Active' : 'Locked'}
                                  </Badge>
                                </div>
                              </div>
                              <Switch 
                                checked={isAllowed}
                                className="data-[state=active]:bg-eve-accent relative z-10"
                                onCheckedChange={async (checked) => {
                                  try {
                                    const newActivities = checked 
                                      ? [...(account.allowedActivities || []), type.id]
                                      : (account.allowedActivities || []).filter(id => id !== type.id)
                                    
                                    const res = await fetch('/api/admin/accounts', {
                                      method: 'PUT',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ userId: account.id, allowedActivities: newActivities })
                                    })
                                    
                                    if (res.ok) {
                                      toast.success(`${type.label} Module updated`)
                                      onRefresh()
                                    }
                                  } catch (err) {
                                    toast.error('Sync failed')
                                  }
                                }}
                              />
                            </div>
                          )
                        })}
                      </div>
                    </motion.div>
                  </TabsContent>

                  {/* PAYMENTS TAB */}
                  <TabsContent value="payments" className="mt-0 outline-none">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-4"
                    >
                      <div className="bg-eve-panel/30 border border-eve-border/30 rounded-2xl overflow-hidden shadow-inner">
                        <Table>
                          <TableHeader className="bg-black/40">
                            <TableRow className="border-eve-border/20 hover:bg-transparent">
                              <TableHead className="text-[10px] uppercase font-bold text-gray-500 pl-6 h-11 tracking-widest">Transaction Date</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold text-gray-500 h-11 tracking-widest">Payer Character</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold text-gray-500 h-11 tracking-widest">Status</TableHead>
                              <TableHead className="text-[10px] uppercase font-bold text-gray-500 text-right pr-6 h-11 tracking-widest">Amount (ISK)</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {account.payments?.map((payment) => (
                              <TableRow key={payment.id} className="border-eve-border/10 hover:bg-eve-accent/5 transition-colors group">
                                <TableCell className="pl-6 py-4">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-white font-medium font-mono"><FormattedDate date={payment.createdAt} /></span>
                                    <span className="text-[9px] text-gray-600 font-mono uppercase tracking-tighter">REF: {payment.id.slice(-8)}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-eve-dark border border-eve-border flex items-center justify-center">
                                      <UserCircle className="h-3.5 w-3.5 text-gray-600" />
                                    </div>
                                    <span className="text-xs text-gray-300 font-medium">{payment.payerCharacterName || t('admin.unknownPayer')}</span>
                                  </div>
                                </TableCell>
                                <TableCell className="py-4">
                                  <Badge variant="outline" className={cn(
                                      "text-[9px] px-2 py-0 h-4.5 border-none capitalize font-bold",
                                      payment.status === 'approved' ? "text-emerald-400 bg-emerald-400/10" : "text-amber-500 bg-amber-500/10"
                                  )}>
                                    {payment.status}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6 py-4">
                                  <div className="flex flex-col items-end">
                                    <span className="font-mono text-green-400 font-bold text-xs group-hover:text-eve-accent transition-colors">
                                      {formatISK(payment.amount)}
                                    </span>
                                    <span className="text-[9px] text-gray-600 font-mono">AUTHORIZED</span>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {(!account.payments || account.payments.length === 0) && (
                              <TableRow>
                                <TableCell colSpan={4} className="h-48 text-center">
                                  <div className="flex flex-col items-center justify-center text-gray-600 opacity-20">
                                    <Wallet className="h-16 w-16 mb-4" />
                                    <p className="text-sm font-outfit uppercase tracking-widest">No transaction ledger entries</p>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </motion.div>
                  </TabsContent>

                  {/* SOCIAL TAB */}
                  <TabsContent value="social" className="mt-0 outline-none">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      {account.friends?.map((friend) => (
                        <div key={friend.id} className="p-4 rounded-xl bg-eve-panel/30 border border-eve-border/40 flex items-center gap-4 group hover:border-eve-accent/30 transition-all shadow-inner">
                          <div className="w-14 h-14 rounded-full bg-eve-dark border border-eve-border flex items-center justify-center group-hover:bg-eve-accent/10 transition-colors shadow-lg">
                            <Users className="h-7 w-7 text-gray-600 group-hover:text-eve-accent transition-colors" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-white group-hover:text-eve-accent transition-colors">{friend.name}</p>
                            <p className="text-[10px] text-gray-500 flex items-center gap-1.5 mt-1 opacity-70">
                              <Calendar className="h-3 w-3" />
                              Added on <FormattedDate date={friend.addedAt} />
                            </p>
                          </div>
                        </div>
                      ))}
                      {(!account.friends || account.friends.length === 0) && (
                        <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-600 border-2 border-dashed border-eve-border/10 rounded-2xl">
                          <Users className="h-16 w-16 mb-4 opacity-10" />
                          <p className="font-outfit text-sm tracking-wide">No social connections indexed</p>
                        </div>
                      )}
                    </motion.div>
                  </TabsContent>

                  {/* MEDALS TAB */}
                  <TabsContent value="medals" className="mt-0 outline-none">
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Award className="h-6 w-6 text-eve-accent" />
                          <div>
                            <h3 className="text-sm font-bold text-white font-outfit">Achievement Record</h3>
                            <p className="text-[11px] text-gray-500">Service medals and merit citations.</p>
                          </div>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-9 px-4 text-[10px] border-eve-accent/40 text-eve-accent hover:bg-eve-accent/10 gap-2 uppercase tracking-widest font-bold shadow-lg"
                          onClick={() => toast.info('Accessing merit registry...')}
                        >
                          <Plus className="h-3.5 w-3.5" /> Grant Medal
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {account.medals?.map((medal) => (
                          <div key={medal.id} className="p-4 rounded-xl bg-eve-panel/50 border border-eve-border/40 flex items-center gap-5 group hover:border-eve-accent/30 transition-all relative overflow-hidden shadow-inner">
                            <div className="absolute top-0 right-0 p-3 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity pointer-events-none">
                              <Award className="h-16 w-16" />
                            </div>
                            
                            <div className="relative z-10 w-16 h-16 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-center text-4xl shadow-2xl group-hover:scale-110 transition-transform">
                              {medal.icon}
                            </div>
                            <div className="flex-1 min-w-0 relative z-10">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-bold text-white group-hover:text-eve-accent transition-colors truncate">{medal.name}</p>
                                {medal.count > 1 && (
                                  <span className="text-[10px] font-mono text-eve-accent bg-eve-accent/10 px-1.5 rounded-sm border border-eve-accent/20">x{medal.count}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[9px] h-4 px-2 capitalize border-eve-accent/20 text-gray-400 font-mono tracking-tighter bg-black/20">{medal.tier}</Badge>
                                <span className="text-[10px] text-gray-500 font-medium">Awarded: <FormattedDate date={medal.awardedAt} /></span>
                              </div>
                            </div>
                          </div>
                        ))}
                        {(!account.medals || account.medals.length === 0) && (
                          <div className="col-span-full flex flex-col items-center justify-center py-24 text-gray-600 border-2 border-dashed border-eve-border/10 rounded-2xl">
                            <Award className="h-16 w-16 mb-4 opacity-10" />
                            <p className="font-outfit text-sm tracking-wide">No achievements recorded in this cycle</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </TabsContent>
                </AnimatePresence>
              </div>
            </Tabs>
          </main>
        </div>
      </DialogContent>
    </Dialog>

  )
}
