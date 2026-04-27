'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { 
  Loader2, Shield, Activity, History, Search, RefreshCw, Wallet, CheckCircle2, XCircle, Zap, Newspaper, Target, Award, Terminal, Gift, TrendingUp, Rocket, Users, Database, Image
} from 'lucide-react'
import { useSession } from '@/lib/session-client'
import { formatISK, cn } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { ACTIVITY_TYPES } from '@/lib/constants/activity-data'
import { ACTIVITY_UI_MAPPING } from '@/lib/constants/activity-ui'
import { MedalManagement } from './MedalManagement'
import { MedalFormDialog } from './MedalFormDialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useTranslations } from '@/i18n/hooks'

// Modular Components
import { StatsRow } from '@/components/admin/StatsRow'
import { AccountList, type AccountData } from '@/components/admin/AccountList'
import { AccountDetailDialog } from '@/components/admin/AccountDetailDialog'
import { GlobalLogs } from '@/components/admin/GlobalLogs'
import { NewsManager } from '@/components/admin/NewsManager'
import { CarouselManager } from '@/components/admin/CarouselManager'
import { SecurityLogs } from '@/components/admin/SecurityLogs'
import { AdminDashboardSkeleton } from '@/components/admin/AdminSkeleton'
import { ScriptRunner } from '@/components/admin/ScriptRunner'
import { CampaignManager } from '@/components/admin/campaigns/CampaignManager'
import { handleAdminError } from '@/lib/admin/error-handler'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'

interface Category {
  id: string
  label: string
  icon: any
  items: { id: string; label: string; icon?: any }[]
}

const getAdminCategories = (t: any): Category[] => [
  {
    id: 'users',
    label: t('admin.catUsers'),
    icon: Users,
    items: [
      { id: 'accounts', label: t('admin.manageAccounts'), icon: Users },
      { id: 'subscriptions', label: t('admin.premiumTab'), icon: Shield },
      { id: 'codes', label: t('admin.codesTab'), icon: Zap },
      { id: 'security', label: t('admin.securityTab'), icon: Shield },
    ]
  },
  {
    id: 'finance',
    label: t('admin.catFinance'),
    icon: Wallet,
    items: [
      { id: 'payments', label: t('admin.esconciliation'), icon: Wallet },
      { id: 'prices', label: t('admin.modulesAndPrices'), icon: TrendingUp },
      { id: 'promo-banners', label: 'Campaigns', icon: Gift },
    ]
  },
  {
    id: 'content',
    label: t('admin.catContent'),
    icon: Newspaper,
    items: [
      { id: 'carousel', label: 'Carousel', icon: Image },
      { id: 'news', label: t('admin.manageNews'), icon: Newspaper },
      { id: 'medals', label: 'Medals', icon: Award },
    ]
  },
  {
    id: 'system',
    label: t('admin.catSystem'),
    icon: Terminal,
    items: [
      { id: 'health', label: t('admin.systemHealth'), icon: Activity },
      { id: 'scripts', label: 'Scripts', icon: Terminal },
    ]
  }
]

interface ModulePrice {
  id: string
  module: string
  price: number
  isActive: boolean
}

interface PaymentRecord {
  id: string
  amount: number
  payerCharacterName: string | null
  status: 'pending' | 'approved' | 'rejected'
  createdAt: string
  journalId: string | null
  userId: string
  user?: {
    name: string
    accountCode: string
  }
}

export function AdminContent() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()
  const { t } = useTranslations()
  const categories = useMemo(() => getAdminCategories(t), [t])
  
  // State
  const [mounted, setMounted] = useState(false)
  const [accounts, setAccounts] = useState<AccountData[]>([])
  const [prices, setPrices] = useState<ModulePrice[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('accounts')
  const [activeCategory, setActiveCategory] = useState('users')
  const [selectedAccount, setSelectedAccount] = useState<AccountData | null>(null)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null)
  const [selectedModules, setSelectedModules] = useState<string[]>(['ratting'])
  const [isSyncing, setIsSyncing] = useState(false)
  const [adminCodes, setAdminCodes] = useState<any[]>([])
  const [premiumUsers, setPremiumUsers] = useState<any[]>([])
  const [paymentSearch, setPaymentSearch] = useState('')
  const [premiumSearch, setPremiumSearch] = useState('')
  const [holdingStatus, setHoldingStatus] = useState({ 
    connected: false, 
    loading: true, 
    characterName: '', 
    isExpired: false 
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  const [serverStats, setServerStats] = useState({
    totalAccounts: 0,
    activeSubscriptions: 0,
    pendingIsk: 0,
    totalCharacters: 0
  })

  // Medal management state
  const [isMedalFormOpen, setIsMedalFormOpen] = useState(false)
  const [editingMedal, setEditingMedal] = useState<any>(null)
  const [medalsKey, setMedalsKey] = useState(0) // Force refresh

  // Memoized Stats
  const stats = useMemo(() => serverStats, [serverStats])

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/codes')
      if (!res.ok) return
      const data = await res.json()
      const list = Array.isArray(data) ? data : data?.codes ?? []
      setAdminCodes(list)
    } catch (err) {
      console.error('Failed to fetch codes:', err)
    }
  }, [])

  const fetchPremiumUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/subscription')
      if (res.ok) setPremiumUsers(await res.json() || [])
    } catch (err) {
      console.error('Failed to fetch premium users:', err)
    }
  }, [])

  const fetchHoldingStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/holding/status')
      if (res.ok) {
        setHoldingStatus({ ...(await res.json()), loading: false })
      }
    } catch (err) {
      console.error('Failed to fetch holding status:', err)
      setHoldingStatus(prev => ({ ...prev, loading: false }))
    }
  }, [])

  const fetchPayments = useCallback(async () => {
    try {
      const payRes = await fetch(`/api/admin/payments?search=${encodeURIComponent(paymentSearch)}`)
      if (payRes.ok) {
        const data = await payRes.json()
        setPayments(data?.items || [])
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err)
      setPayments([])
    }
  }, [paymentSearch])

  const fetchAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [accRes, priceRes, statsRes] = await Promise.all([
        fetch('/api/admin/accounts'),
        fetch('/api/admin/module-prices'),
        fetch('/api/admin/stats')
      ])
      
      if (accRes.ok) {
        const data = await accRes.json()
        setAccounts(data?.accounts || [])
      }
      
      if (priceRes.ok) {
        const data = await priceRes.json()
        setPrices(data || [])
      }
      
      if (statsRes.ok) {
        const data = await statsRes.json()
        setServerStats(prev => data || prev)
      }
      
      await Promise.all([fetchPayments(), fetchCodes()])
    } catch (err) {
      console.error('Failed to fetch admin data:', err)
    } finally {
      setLoading(false)
    }
  }, [fetchPayments, fetchCodes])

  useEffect(() => {
    if (sessionStatus === 'unauthenticated' || (sessionStatus === 'authenticated' && session?.user?.role !== 'master')) {
      router.push('/dashboard')
      return
    }
  }, [sessionStatus, session, router])

  useEffect(() => {
    if (sessionStatus === 'authenticated' && mounted) {
      void fetchAllData()
      void fetchPremiumUsers()
      void fetchHoldingStatus()
    }
  }, [sessionStatus, mounted, fetchAllData, fetchPremiumUsers, fetchHoldingStatus])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !mounted || activeTab !== 'payments') {
      return
    }
    const holdingInterval = setInterval(() => {
      void fetchHoldingStatus()
    }, 30000)
    return () => clearInterval(holdingInterval)
  }, [sessionStatus, mounted, activeTab, fetchHoldingStatus])

  useEffect(() => {
    if (sessionStatus === 'authenticated' && mounted) {
      const timer = setTimeout(() => fetchPayments(), 500)
      return () => clearTimeout(timer)
    }
  }, [paymentSearch, sessionStatus, fetchPayments, mounted])

  const handleCategoryChange = (categoryId: string) => {
    setActiveCategory(categoryId)
    const category = categories.find(c => c.id === categoryId)
    if (category && category.items.length > 0) {
      if (!category.items.some(i => i.id === activeTab)) {
        setActiveTab(category.items[0].id)
      }
    }
  }

  useEffect(() => {
    const category = categories.find(c => c.items.some(i => i.id === activeTab))
    if (category && category.id !== activeCategory) {
      setActiveCategory(category.id)
    }
  }, [activeTab, categories, activeCategory])

  const handleConnectHolding = () => {
    window.location.href = '/api/auth/signin?app=holding'
  }

  const handleSyncWallet = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/admin/payments/sync', { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        toast.success(t('admin.syncSuccess').replace('{count}', data.newPaymentsCount))
        fetchAllData()
      } else {
        const error = await res.json()
        handleAdminError(error, t('admin.syncAPIError'))
      }
    } catch (err) {
      handleAdminError(err, t('admin.syncAPIError'))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleApprovePayment = async (paymentId: string) => {
    setSelectedPaymentId(paymentId)
    setIsApproveDialogOpen(true)
  }

  const confirmApprovePayment = async () => {
    if (!selectedPaymentId) return
    setIsSyncing(true)
    try {
      const res = await fetch(`/api/admin/payments/${selectedPaymentId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allowedActivities: selectedModules, months: 1 })
      })
      if (!res.ok) {
        const error = await res.json()
        throw error
      }
      toast.success(t('admin.paymentApproved'))
      setIsApproveDialogOpen(false)
      fetchAllData()
    } catch (error) {
      handleAdminError(error, t('admin.paymentApproveError'))
    } finally {
      setIsSyncing(false)
    }
  }

  const handleLinkPayment = async (paymentId: string, userId: string) => {
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/link`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      })
      if (res.ok) {
        toast.success(t('admin.paymentLinked'))
        fetchAllData()
      } else {
        const error = await res.json()
        handleAdminError(error, t('admin.linkError'))
      }
    } catch (err) {
      handleAdminError(err, t('admin.linkError'))
    }
  }

  const grantPremium = async (userId: string, type: 'LIFETIME' | 'DAYS_30' | 'PL8R') => {
    try {
      const res = await fetch('/api/admin/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, type })
      })
      if (res.ok) {
        const data = await res.json()
        const typeLabel = type === 'LIFETIME' ? t('admin.codeTypeLifetime') : type === 'PL8R' ? t('admin.codeTypePL8R') : t('admin.codeType30')
        toast.success(`${typeLabel} ${t('admin.grantedTo')} ${data.userName || userId}!`)
        fetchPremiumUsers()
        return true
      } else {
        const err = await res.json()
        handleAdminError(err, t('admin.grantError'))
        return false
      }
    } catch (err) {
      handleAdminError(err, t('admin.grantError'))
      return false
    }
  }

  if (!mounted || loading) {
    return <AdminDashboardSkeleton />
  }

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between border-b border-eve-border/20 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-eve-accent" />
            <h1 className="text-3xl font-bold text-white tracking-tight">{t('admin.adminPanel')}</h1>
          </div>
          <p className="text-gray-400 mt-1">{t('admin.adminSubtitle')}</p>
        </div>
        <Badge variant="outline" className="bg-eve-accent/20 text-eve-accent border-eve-accent px-3 py-1">
          <Shield className="h-3 w-3 mr-2" />
          {t('admin.roleMaster')}
        </Badge>
      </div>

      <StatsRow 
        totalAccounts={stats.totalAccounts}
        activeSubscriptions={stats.activeSubscriptions}
        pendingIsk={stats.pendingIsk}
        totalCharacters={stats.totalCharacters}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategoryChange(cat.id)}
            className={cn(
              "flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 group relative overflow-hidden",
              activeCategory === cat.id
                ? "bg-eve-accent/10 border-eve-accent shadow-[0_0_20px_rgba(0,200,255,0.15)]"
                : "bg-eve-panel/40 border-eve-border/50 hover:bg-eve-panel/60 hover:border-eve-border"
            )}
          >
            <div className={cn(
              "p-3 rounded-xl mb-3 transition-colors",
              activeCategory === cat.id ? "bg-eve-accent text-black" : "bg-eve-dark/50 text-gray-400 group-hover:text-white"
            )}>
              <cat.icon className="h-6 w-6" />
            </div>
            <span className={cn(
              "font-bold tracking-tight text-sm",
              activeCategory === cat.id ? "text-white" : "text-gray-400 group-hover:text-gray-200"
            )}>
              {cat.label}
            </span>
            {activeCategory === cat.id && (
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-eve-accent" />
            )}
          </button>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <ScrollArea className="w-full whitespace-nowrap rounded-xl border border-eve-border/30 bg-eve-panel/30 backdrop-blur-sm">
          <TabsList className="inline-flex w-max justify-start bg-transparent border-none p-1 gap-1 px-2">
            {categories.find(c => c.id === activeCategory)?.items.map((item) => (
              <TabsTrigger 
                key={item.id}
                value={item.id} 
                className="data-[state=active]:bg-eve-accent data-[state=active]:text-black font-bold transition-all duration-200 h-9 px-4 rounded-lg flex items-center gap-2"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <ScrollBar orientation="horizontal" className="invisible" />
        </ScrollArea>

        <TabsContent value="accounts">
          <ErrorBoundary name="Admin — Accounts">
            <AccountList accounts={accounts} onSelectAccount={(acc) => setSelectedAccount(acc)} />
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="medals" className="space-y-4">
          <ErrorBoundary name="Admin — Medals">
          <Card className="bg-eve-panel border-eve-border shadow-xl overflow-hidden">
            <CardHeader className="bg-eve-dark/30 border-b border-eve-border/50 flex flex-row items-center justify-between">
              <div>
                <CardTitle>Medal Management</CardTitle>
                <CardDescription>Create, edit and manage EasyEve medals</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <MedalManagement 
                key={medalsKey}
                onEdit={(medal) => {
                  setEditingMedal(medal)
                  setIsMedalFormOpen(true)
                }}
                onCreate={() => {
                  setEditingMedal(null)
                  setIsMedalFormOpen(true)
                }}
              />
            </CardContent>
          </Card>
          </ErrorBoundary>
          <MedalFormDialog 
            open={isMedalFormOpen}
            onOpenChange={setIsMedalFormOpen}
            medal={editingMedal}
            onSuccess={() => setMedalsKey(k => k + 1)}
          />
        </TabsContent>

        <TabsContent value="prices" className="space-y-4">
          <ErrorBoundary name="Admin — Module prices">
          <Card className="bg-eve-panel border-eve-border shadow-xl overflow-hidden">
            <CardHeader className="bg-eve-dark/30 border-b border-eve-border/50">
              <CardTitle>{t('admin.modulesConfig')}</CardTitle>
              <CardDescription>{t('admin.modulePriceDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-eve-border/30">
                  <Target className="h-4 w-4 text-red-400" />
                  <span className="text-xs font-bold text-red-400 uppercase tracking-wider">Activity Tracker</span>
                </div>
                {ACTIVITY_TYPES?.map(type => {
                  const typeId = type.id
                  const dbPrice = prices.find(p => p.module === typeId)
                  const ui = ACTIVITY_UI_MAPPING[typeId as keyof typeof ACTIVITY_UI_MAPPING]
                  const Icon = ui?.icon || Activity

                  if (!type) return null
                  
                  return (
                    <div key={typeId} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-eve-dark/40 border border-eve-border/50 hover:bg-eve-dark/60 transition-colors gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={cn("p-2 rounded-lg bg-eve-dark", (ui?.color || "text-gray-400").replace('text-', 'bg-') + '/10')}>
                          <Icon className={cn("h-6 w-6", ui?.color || "text-eve-accent")} />
                        </div>
                        <div>
                          <p className="text-white font-bold">{type.label}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mt-1">{type.id}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-400">{t('admin.saleStatus')}</Label>
                          <Switch 
                            checked={dbPrice?.isActive ?? true} 
                            onCheckedChange={async (checked) => {
                              await fetch('/api/admin/module-prices', {
                                method: 'POST',
                                body: JSON.stringify({ module: typeId, isActive: checked })
                              })
                              fetchAllData()
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-eve-border/30">
                  <Shield className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Fits</span>
                </div>
                {['fits'].map((typeId) => {
                  const dbPrice = prices.find(p => p.module === typeId)
                  const label = 'Fit Management'
                  return (
                    <div key={typeId} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-eve-dark/40 border border-eve-border/50 hover:bg-eve-dark/60 transition-colors gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="p-2 rounded-lg bg-purple-500/10">
                          <Rocket className="h-6 w-6 text-purple-400" />
                        </div>
                        <div>
                          <p className="text-white font-bold">{label}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mt-1">{typeId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-400">{t('admin.saleStatus')}</Label>
                          <Switch 
                            checked={dbPrice?.isActive ?? true} 
                            onCheckedChange={async (checked) => {
                              await fetch('/api/admin/module-prices', {
                                method: 'POST',
                                body: JSON.stringify({ module: typeId, isActive: checked })
                              })
                              fetchAllData()
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b border-eve-border/30">
                  <TrendingUp className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Finance</span>
                </div>
                {['finance', 'market'].map((typeId) => {
                  const dbPrice = prices.find(p => p.module === typeId)
                  const ui = ACTIVITY_UI_MAPPING[typeId as keyof typeof ACTIVITY_UI_MAPPING]
                  const Icon = ui?.icon || (typeId === 'market' ? Database : TrendingUp)
                  const label = typeId === 'market' ? 'Market Browser' : t('sidebar.finance')
                  
                  return (
                    <div key={typeId} className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl bg-eve-dark/40 border border-eve-border/50 hover:bg-eve-dark/60 transition-colors gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className={cn("p-2 rounded-lg bg-eve-dark", (ui?.color || (typeId === 'market' ? "text-blue-400" : "text-emerald-400")).replace('text-', 'bg-') + '/10')}>
                          <Icon className={cn("h-6 w-6", ui?.color || (typeId === 'market' ? "text-blue-400" : "text-emerald-400"))} />
                        </div>
                        <div>
                          <p className="text-white font-bold">{label}</p>
                          <p className="text-[10px] text-gray-500 uppercase tracking-widest leading-none mt-1">{typeId}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Label className="text-xs text-gray-400">{t('admin.saleStatus')}</Label>
                          <Switch 
                            checked={dbPrice?.isActive ?? true} 
                            onCheckedChange={async (checked) => {
                              await fetch('/api/admin/module-prices', {
                                method: 'POST',
                                body: JSON.stringify({ module: typeId, isActive: checked })
                              })
                              fetchAllData()
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <ErrorBoundary name="Admin — Payments / ESI">
          <Card className="bg-eve-dark/40 border-eve-border/50 border-dashed">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-full", holdingStatus.connected ? (holdingStatus.isExpired ? "bg-yellow-500/10" : "bg-green-500/10") : "bg-red-500/10")}>
                  <Shield className={cn("h-5 w-5", holdingStatus.connected ? (holdingStatus.isExpired ? "text-yellow-500" : "text-green-500") : "text-red-500")} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {t('admin.walletCEO')}
                    {holdingStatus.connected && (
                      <Badge variant="outline" className={cn("text-[9px] h-4", holdingStatus.isExpired ? "text-yellow-500 border-yellow-500/30" : "text-green-500 border-green-500/30")}>
                        {holdingStatus.isExpired ? t('admin.tokenExpired') : t('admin.tokenActive')}
                      </Badge>
                    )}
                  </h3>
                  <p className="text-[10px] text-gray-500">{holdingStatus.connected ? `${t('admin.connectedVia')} ${holdingStatus.characterName}` : t('admin.noCEOConnected')}</p>
                </div>
              </div>
              <Button onClick={handleConnectHolding} variant="outline" size="sm" className="h-8 text-[10px] bg-eve-dark border-eve-border hover:bg-eve-accent hover:text-black transition-all">
                {holdingStatus.connected ? t('admin.toggleReconnectCEO') : t('admin.connectWalletCEO')}
              </Button>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2"><History className="h-5 w-5 text-eve-accent" />{t('admin.transactionHistory')}</h2>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input placeholder={t('common.search')} className="pl-9 h-9 w-[200px] bg-eve-dark border-eve-border text-xs" value={paymentSearch} onChange={(e) => setPaymentSearch(e.target.value)} />
              </div>
              <Button onClick={handleSyncWallet} disabled={isSyncing} className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {t('admin.syncESI')}
              </Button>
            </div>
          </div>

          <Card className="bg-eve-panel border-eve-border shadow-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-eve-dark/50 border-b border-eve-border/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">{t('admin.dateTime')}</th>
                      <th className="px-6 py-4">{t('admin.payer')}</th>
                      <th className="px-6 py-4 text-right">{t('admin.value')}</th>
                      <th className="px-6 py-4">{t('admin.status')}</th>
                      <th className="px-6 py-4 text-right">{t('admin.action')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-eve-border/30">
                    {payments.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">{t('admin.noPaymentFound')}</td></tr>
                    ) : (
                      payments.map(payment => (
                        <tr key={payment.id} className="hover:bg-eve-dark/10 transition-colors">
                          <td className="px-6 py-4 text-gray-400 text-xs">
                            <p className="font-bold text-gray-300">
                              <FormattedDate date={payment.createdAt} />
                            </p>
                            <p className="opacity-60">
                              <FormattedDate date={payment.createdAt} options={{ hour: '2-digit', minute: '2-digit' }} />
                            </p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-white font-bold mb-1.5 flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-eve-accent" />{payment.payerCharacterName || t('admin.unknownPayer')}</p>
                            <Select defaultValue={payment.userId} onValueChange={(val) => handleLinkPayment(payment.id, val)}>
                              <SelectTrigger className="h-8 w-[220px] text-[10px] bg-eve-dark/40 border-eve-border/50 hover:border-eve-accent/50 transition-all">
                                <SelectValue placeholder={t('admin.linkToAccount')} />
                              </SelectTrigger>
                              <SelectContent className="bg-eve-panel border-eve-border">
                                {accounts.map(acc => (
                                  <SelectItem key={acc.id} value={acc.id} className="text-[10px]">{acc.name || acc.accountCode} ({acc.accountCode})</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-green-400 font-bold">{formatISK(payment.amount)}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-none", payment.status === 'pending' ? "text-yellow-500 bg-yellow-500/10" : payment.status === 'approved' ? "text-green-500 bg-green-500/10" : "text-red-500 bg-red-500/10")}>
                              {payment.status.toUpperCase()}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-right">
                            {payment.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2">
                                <Button size="sm" className="h-8 bg-green-600 hover:bg-green-500 text-white font-bold px-4" onClick={() => handleApprovePayment(payment.id)}>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  {t('admin.approve')}
                                </Button>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500 hover:bg-red-500/10" onClick={async () => { await fetch(`/api/admin/payments/${payment.id}/reject`, { method: 'POST' }); fetchAllData(); }}><XCircle className="h-4 w-4" /></Button>
                              </div>
                            )}
                            {(payment as any).status === 'auto_approved' && (
                              <div className="flex items-center justify-end gap-2 text-cyan-500">
                                <CheckCircle2 className="h-5 w-5" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">AUTO-APPROVED</span>
                              </div>
                            )}
                            {payment.status === 'approved' && (
                              <div className="flex items-center justify-end gap-2 text-green-500">
                                <span className="text-[10px] font-bold uppercase tracking-widest">{t('admin.reconciled')}</span>
                                <CheckCircle2 className="h-5 w-5" />
                              </div>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="codes" className="space-y-6">
          <ErrorBoundary name="Admin — Activation codes">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="h-5 w-5 text-eve-accent" />{t('admin.codeGenerator')}</h2>
              <p className="text-xs text-gray-500">{t('admin.codeGeneratorDesc')}</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={async () => {
                const res = await fetch('/api/admin/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'DAYS_30', count: 1 }) });
                if (res.ok) { toast.success(t('admin.codeGenerated30')); fetchCodes(); }
              }} className="bg-eve-accent text-black hover:bg-eve-accent/80 font-bold h-9">{t('admin.generate30Days')}</Button>
              <Button onClick={async () => {
                const res = await fetch('/api/admin/codes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'LIFETIME', count: 1 }) });
                if (res.ok) { toast.success(t('admin.codeGeneratedLifetime')); fetchCodes(); }
              }} variant="outline" className="border-eve-accent text-eve-accent hover:bg-eve-accent/10 font-bold h-9">{t('admin.generateLifetime')}</Button>
            </div>
          </div>

          <Card className="bg-eve-panel border-eve-border shadow-2xl overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-eve-dark/50 border-b border-eve-border/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">{t('admin.code')}</th>
                      <th className="px-6 py-4">{t('admin.type')}</th>
                      <th className="px-6 py-4">{t('admin.status')}</th>
                      <th className="px-6 py-4">{t('admin.createdAt')}</th>
                      <th className="px-6 py-4">Created By</th>
                      <th className="px-6 py-4">{t('admin.usage')}</th>
                      <th className="px-6 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-eve-border/30">
                    {adminCodes.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">{t('admin.noCodesGenerated')}</td></tr>
                    ) : (
                      adminCodes.map(code => (
                        <tr key={code.id} className="hover:bg-eve-dark/10 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-eve-accent flex items-center gap-2">
                            {code.code}
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-eve-accent/10" onClick={() => { navigator.clipboard.writeText(code.code); toast.success(t('admin.copied')); }}>
                              <RefreshCw className="h-3 w-3" />
                            </Button>
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={cn("text-[10px] font-bold", code.type === 'LIFETIME' ? "bg-purple-500/20 text-purple-400 border-purple-500/50" : code.type === 'PL8R' ? "bg-amber-500/20 text-amber-400 border-amber-500/50" : code.type === 'DAYS_7' ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50" : "bg-blue-500/20 text-blue-400 border-blue-500/50")}>
                              {code.type === 'LIFETIME' ? t('admin.codeTypeLifetime') : code.type === 'PL8R' ? t('admin.codeTypePL8R') : code.type === 'DAYS_7' ? '7 Days' : t('admin.codeType30')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0 border-none", 
                              code.isInvalidated 
                                ? "text-gray-500 bg-gray-500/10" 
                                : code.isUsed 
                                  ? "text-red-500 bg-red-500/10" 
                                  : "text-green-500 bg-green-500/10")}>
                              {code.isInvalidated ? 'Invalidated' : code.isUsed ? t('admin.codeUsed') : t('admin.codeAvailable')}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            <FormattedDate date={code.createdAt} options={{ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }} />
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-500">
                            {code.usedAt 
                              ? <FormattedDate date={code.usedAt} options={{ year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }} />
                              : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400">
                            {code.creator?.name 
                              ? `${code.creator.name} (${code.creator.accountCode})`
                              : code.createdBy || '-'}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400">{code.usedBy ? (code.usedBy.name || code.usedBy.accountCode || code.usedById?.slice(0, 8)) : '-'}</td>
                          <td className="px-6 py-4">
                            {(!code.isUsed && !code.isInvalidated) && (
                              <Button size="sm" variant="ghost" className="h-7 text-red-400 hover:bg-red-500/10" onClick={async () => {
                                const res = await fetch(`/api/admin/codes?id=${code.id}`, { method: 'DELETE' })
                                if (res.ok) { toast.success('Code invalidated'); fetchCodes(); }
                                else { toast.error('Failed to invalidate code') }
                              }}>
                                <XCircle className="h-4 w-4 mr-1" />
                                Invalidate
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <ErrorBoundary name="Admin — Premium subscriptions">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2"><Shield className="h-5 w-5 text-eve-accent" />{t('admin.premiumManagement')}</h2>
              <p className="text-xs text-gray-500">{t('admin.premiumManagementDesc')}</p>
            </div>
            <Button onClick={fetchPremiumUsers} variant="outline" className="border-eve-border text-gray-400 hover:text-white"><RefreshCw className="h-4 w-4 mr-2" />{t('characters.refresh')}</Button>
          </div>

          <Card className="bg-eve-panel border-eve-border shadow-xl overflow-hidden">
            <CardContent className="p-0">
              <div className="p-4 border-b border-eve-border/30">
                <Input
                  placeholder={t('admin.searchPlaceholder')}
                  value={premiumSearch}
                  onChange={(e) => setPremiumSearch(e.target.value)}
                  className="max-w-sm bg-eve-dark border-eve-border"
                />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-eve-dark/50 border-b border-eve-border/50 text-gray-400 uppercase text-[10px] font-bold tracking-widest">
                    <tr>
                      <th className="px-6 py-4">{t('admin.user')}</th>
                      <th className="px-6 py-4">{t('admin.status')}</th>
                      <th className="px-6 py-4">{t('admin.expires')}</th>
                      <th className="px-6 py-4">{t('admin.type')}</th>
                      <th className="px-6 py-4">{t('admin.actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-eve-border/30">
                    {premiumUsers.length === 0 ? (
                      <tr><td colSpan={5} className="px-6 py-12 text-center text-gray-500 italic">{t('admin.noPremiumUsers')}</td></tr>
                    ) : (
                      premiumUsers.filter(user => {
                        if (!premiumSearch) return true
                        const search = premiumSearch.toLowerCase()
                        return (user.name || '').toLowerCase().includes(search) ||
                               (user.accountCode || '').toLowerCase().includes(search)
                      }).map(user => (
                        <tr key={user.id} className="hover:bg-eve-dark/10 transition-colors">
                          <td className="px-6 py-4"><div><p className="text-white font-medium">{user.name || user.accountCode || t('admin.noName')}</p><p className="text-xs text-gray-500">{user.accountCode || t('admin.notAvailable')}</p></div></td>
                          <td className="px-6 py-4"><Badge className={cn("text-[10px] font-bold", user.hasPremium ? "bg-green-500/20 text-green-400 border-green-500/50" : "bg-red-500/20 text-red-400 border-red-500/50")}>{user.hasPremium ? t('admin.userActive') : t('admin.userExpired')}</Badge></td>
                          <td className="px-6 py-4 text-xs text-gray-400">{user.subscriptionEnd ? <FormattedDate date={user.subscriptionEnd} /> : t('admin.notAvailable')}</td>
                          <td className="px-6 py-4">{user.isPulaLeeroy && <Badge className="text-[10px] bg-amber-500/20 text-amber-400 border-amber-500/50">PL8R</Badge>}</td>
                          <td className="px-6 py-4"><div className="flex gap-2"><Button size="sm" variant="outline" className="h-8 border-purple-500/50 text-purple-400 hover:bg-purple-500/10" onClick={() => grantPremium(user.id, 'LIFETIME')}>{t('admin.lifetime')}</Button><Button size="sm" variant="outline" className="h-8 border-blue-500/50 text-blue-400 hover:bg-blue-500/10" onClick={() => grantPremium(user.id, 'DAYS_30')}>{t('admin.add30Days')}</Button></div></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          </ErrorBoundary>
        </TabsContent>

        <TabsContent value="scripts">
          <ErrorBoundary name="Admin — Scripts">
            <ScriptRunner isTabActive={activeTab === 'scripts'} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="health">
          <ErrorBoundary name="Admin — System health">
            <GlobalLogs enablePolling={activeTab === 'health'} />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="promo-banners">
          <ErrorBoundary name="Admin — Promo banners">
            <CampaignManager />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="carousel">
          <ErrorBoundary name="Admin — Carousel">
            <CarouselManager />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="news">
          <ErrorBoundary name="Admin — News">
            <NewsManager />
          </ErrorBoundary>
        </TabsContent>
        <TabsContent value="security">
          <ErrorBoundary name="Admin — Security logs">
            <SecurityLogs enablePolling={activeTab === 'security'} />
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

      <AccountDetailDialog account={selectedAccount} isOpen={!!selectedAccount} onClose={() => setSelectedAccount(null)} onRefresh={fetchAllData} />
      
      <Dialog open={isApproveDialogOpen} onOpenChange={setIsApproveDialogOpen}>
        <DialogContent className="sm:max-w-[425px] bg-eve-panel border-eve-border text-white">
          <DialogHeader><DialogTitle>{t('admin.confirmPayment')}</DialogTitle><DialogDescription className="text-gray-400">{t('admin.selectModules')}</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {(ACTIVITY_TYPES || []).map((activity) => (
                <div key={activity.id} onClick={() => setSelectedModules(prev => prev.includes(activity.id) ? prev.filter(m => m !== activity.id) : [...prev, activity.id])} className={cn("flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all", selectedModules.includes(activity.id) ? "bg-eve-accent/10 border-eve-accent text-eve-accent" : "bg-eve-dark border-eve-border hover:border-gray-500")}>
                  <div className={cn("p-2 rounded-lg", selectedModules.includes(activity.id) ? "bg-eve-accent/10" : "bg-black/20")}>
                    {(() => {
                      const Icon = ACTIVITY_UI_MAPPING[activity.id]?.icon || Activity
                      return <Icon className={cn("h-5 w-5", ACTIVITY_UI_MAPPING[activity.id]?.color || (selectedModules.includes(activity.id) ? "text-eve-accent" : "text-gray-500"))} />
                    })()}
                  </div>
                  <span className="text-sm font-medium">{activity.label}</span>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="bg-eve-dark/30 p-4 -m-6 mt-4 border-t border-eve-border/50">
            <Button variant="ghost" onClick={() => setIsApproveDialogOpen(false)} className="text-gray-400">{t('admin.cancel')}</Button>
            <Button onClick={confirmApprovePayment} disabled={isSyncing || selectedModules.length === 0} className="bg-eve-accent text-black font-bold hover:bg-eve-accent/80">{isSyncing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t('admin.confirmApproval')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
