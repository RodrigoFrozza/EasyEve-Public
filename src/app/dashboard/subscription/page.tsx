'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useSession } from '@/lib/session-client'
import { cn, formatISK, isPremium } from '@/lib/utils'
import { 
  Crown, Wallet, CheckCircle2, Copy, Check, 
  Sparkles, Loader2, Coins, ArrowUpRight, History
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { motion } from 'framer-motion'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { FormattedDate } from '@/components/shared/FormattedDate'
import {
  ACTIVATION_CODE_TYPES,
  getActivationCodeDurationDays,
} from '@/lib/activation-codes'
import { PremiumInfoModal } from '@/components/subscription/PremiumInfoModal'

const CORP_NAME = "Easy Eve Holding's"
const SUBSCRIPTION_COST_ISK = 100_000_000
const SUBSCRIPTION_DAYS = 30

interface IskHistoryItem {
  id: string
  amount: number
  type: string
  reference: string | null
  createdAt: string
}

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const redeemInputRef = useRef<HTMLInputElement | null>(null)
  const [copied, setCopied] = useState(false)
  const [iskBalance, setIskBalance] = useState<number>(0)
  const [iskHistory, setIskHistory] = useState<IskHistoryItem[]>([])
  const [isLoadingBalance, setIsLoadingBalance] = useState(true)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [nextSyncSeconds, setNextSyncSeconds] = useState<number | null>(null)
  const [isPulaMember, setIsPulaMember] = useState(false)
  const [activationCode, setActivationCode] = useState('')
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [hasPromoCodeInUrl, setHasPromoCodeInUrl] = useState(false)
  const { t } = useTranslations()

  const hasPremium = isPremium(session?.user?.subscriptionEnd)
  const isExpired = session?.user?.subscriptionEnd && new Date(session.user.subscriptionEnd) < new Date()
  const canAfford = iskBalance >= SUBSCRIPTION_COST_ISK
  const showPulaBanner = isPulaMember && !hasPremium

  const fetchIskData = useCallback(async () => {
    setIsLoadingBalance(true)
    try {
      const [balanceRes, historyRes] = await Promise.all([
        fetch('/api/subscription/isk'),
        fetch('/api/subscription/isk-history'),
      ])

      if (balanceRes.ok) {
        const balanceData = await balanceRes.json()
        setIskBalance(balanceData.iskBalance || 0)
        setLastSyncTime(balanceData.lastSync)
      } else {
        toast.error(t('subscription.walletBalanceLoadError'))
      }

      if (historyRes.ok) {
        const historyData = await historyRes.json()
        setIskHistory(historyData.history || [])
      } else if (balanceRes.ok) {
        toast.error(t('subscription.walletHistoryLoadError'))
      }
    } catch (err) {
      console.error('[ISK Data] Error:', err)
      toast.error(t('subscription.walletBalanceLoadError'))
    } finally {
      setIsLoadingBalance(false)
    }
  }, [t])

  const checkPulaMember = useCallback(async () => {
    try {
      const res = await fetch('/api/subscription/check-pula')
      const data = await res.json()
      setIsPulaMember(data.isPulaLeeroy === true)
    } catch (err) {
      console.error('Failed to check Pula membership:', err)
    }
  }, [])

  useEffect(() => {
    void fetchIskData()
  }, [fetchIskData])

  useEffect(() => {
    void checkPulaMember()
  }, [checkPulaMember])

  useEffect(() => {
    const promoCode = searchParams.get('promoCode')

    // Priority 1: Check localStorage for Pula Leeroy code
    const storedCode = typeof window !== 'undefined' ? localStorage.getItem('pulaLeeroy_personal_code') : null
    
    if (storedCode && !activationCode) {
      setActivationCode(storedCode.toUpperCase())
      setHasPromoCodeInUrl(true)
      window.requestAnimationFrame(() => {
        redeemInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        redeemInputRef.current?.focus()
        redeemInputRef.current?.select()
      })
    } else if (promoCode) {
      setHasPromoCodeInUrl(true)
      setActivationCode(promoCode.toUpperCase())

      window.requestAnimationFrame(() => {
        redeemInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        redeemInputRef.current?.focus()
        redeemInputRef.current?.select()
      })
    } else {
      setHasPromoCodeInUrl(false)
    }
  }, [searchParams, activationCode])

  // Countdown effect
  useEffect(() => {
    if (!lastSyncTime) return

    const SYNC_INTERVAL_MINS = 15
    const intervalMs = SYNC_INTERVAL_MINS * 60 * 1000
    
    const updateCountdown = () => {
      const last = new Date(lastSyncTime).getTime()
      const now = Date.now()
      const elapsed = now - last
      
      // Calculate time until next 15-min interval
      const remaining = intervalMs - (elapsed % intervalMs)
      setNextSyncSeconds(Math.floor(remaining / 1000))
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [lastSyncTime])

  const formatCountdown = (seconds: number | null) => {
    if (seconds === null) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const copyCorp = () => {
    navigator.clipboard.writeText(CORP_NAME)
    setCopied(true)
    toast.success(t('subscription.corpNameCopied'))
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    try {
      const res = await fetch('/api/subscription/subscribe', { method: 'POST' })
      const data = await res.json()
      
      if (res.ok) {
        toast.success(t('subscription.subscribeSuccess', { 
          days: SUBSCRIPTION_DAYS,
          date: new Date(data.subscriptionEnd).toLocaleDateString() 
        }))
        setShowConfirmModal(false)
        window.location.reload()
      } else {
        toast.error(data.error || t('subscription.subscribeError'))
      }
    } catch (err) {
      toast.error(t('subscription.connectionError'))
    } finally {
      setIsSubscribing(false)
    }
  }

  const formatHistoryType = (type: string) => {
    switch (type) {
      case 'payment': return t('subscription.payment')
      case 'subscription': return t('subscription.subscription')
      default: return t('subscription.historyTypeOther')
    }
  }

  const handleRedeemCode = async () => {
    if (!activationCode.trim()) {
      toast.error(t('subscription.codeRequired') || 'Code is required')
      return
    }

    setIsRedeeming(true)
    try {
      const res = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activationCode.trim() })
      })
      const data = await res.json()

      if (res.ok) {
        const isLifetime =
          data.type === ACTIVATION_CODE_TYPES.LIFETIME ||
          data.type === ACTIVATION_CODE_TYPES.PL8R
        const durationDays = getActivationCodeDurationDays(data.type)
        if (isLifetime) {
          toast.success(t('subscription.codeRedeemedLifetime'))
        } else if (durationDays !== null) {
          toast.success(t('subscription.codeRedeemed', { days: durationDays }))
        } else {
          toast.success(t('subscription.codeRedeemedLifetime'))
        }
        setActivationCode('')
        window.location.reload()
      } else {
        toast.error(data.message || t('subscription.codeInvalid'))
      }
    } catch (err) {
      toast.error(t('subscription.connectionError'))
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-24 px-4">
      {/* Header */}
      <div className="text-center space-y-4 py-8">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-eve-accent/10 border border-eve-accent/20 text-eve-accent text-xs font-bold uppercase tracking-widest"
        >
          <Sparkles className="h-3 w-3" />
          {t('subscription.premiumTacticalAdvantage')}
        </motion.div>
        <div className="flex items-center justify-center gap-4">
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
            {t('subscription.premium')}
          </h1>
          <PremiumInfoModal />
        </div>
        <p className="text-gray-400 max-w-xl mx-auto">
          {t('subscription.unlockPotential')}
        </p>
      </div>

      {/* Pula Leeroy Banner - Show if user is Pula member but no premium */}
      {showPulaBanner && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="bg-gradient-to-r from-amber-950/50 via-amber-900/30 to-amber-950/50 border-amber-500/30 overflow-hidden">
          <CardContent className="p-0">
            <Link
              href="/dashboard/subscription/leroy"
              className="flex items-center justify-between p-4 hover:bg-amber-500/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                  <Crown className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <p className="text-amber-400 font-bold">{t('subscription.leroy.pulaMember') || 'Pula Leeroy Member Detected!'}</p>
                  <p className="text-zinc-400 text-sm">{t('subscription.leroy.claimReward') || 'Click to claim your FREE lifetime premium code'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <Sparkles className="h-5 w-5 animate-pulse" />
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </Link>
          </CardContent>
        </Card>
      </motion.div>
      )}

      {/* Code Activation Input - Show if no premium OR has code to redeem */}
      {(!hasPremium || activationCode || hasPromoCodeInUrl) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          id="premium-code-redeem"
        >
          <Card className="bg-gradient-to-br from-indigo-950/30 to-purple-950/20 border-indigo-500/20">
            <CardContent className="p-6">
              {hasPromoCodeInUrl && (
                <div className="mb-4 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3">
                  <p className="text-sm font-semibold text-cyan-200">
                    {t('subscription.promoCodeReadyHint')}
                  </p>
                </div>
              )}
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="text-xs text-indigo-400 font-bold uppercase tracking-wider mb-2 block">
                    {t('subscription.codeActivationTitle') || 'Activate Premium Code'}
                  </label>
                  <input
                    ref={redeemInputRef}
                    type="text"
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value.toUpperCase())}
                    placeholder={t('subscription.codePlaceholder') || 'Ex: PL8R-A1B2 ou código recebido'}
                    className="w-full h-12 bg-black/50 border border-indigo-500/30 rounded-lg px-4 text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-400 font-mono text-lg"
                  />
                  <p className="text-xs text-zinc-500 mt-2">{t('subscription.codeActivationDesc')}</p>
                </div>
                <Button
                  onClick={handleRedeemCode}
                  disabled={isRedeeming || !activationCode.trim()}
                  className="h-12 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold disabled:opacity-50"
                >
                  {isRedeeming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    t('subscription.redeemCode') || 'Redeem'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ISK Balance Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-br from-zinc-900 to-zinc-950 border-zinc-800 overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Coins className="h-7 w-7 text-amber-400" />
                </div>
                <div>
                  <p className="text-zinc-400 text-sm uppercase font-bold tracking-wider">{t('subscription.yourBalance')}</p>
                  {isLoadingBalance ? (
                    <div className="h-8 w-32 bg-zinc-800 animate-pulse rounded mt-1" />
                  ) : (
                    <p className="text-2xl font-black text-amber-400">{formatISK(iskBalance)}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                      <History className="h-3 w-3" />
                      {lastSyncTime ? (
                        <span>{t('global.nextSync')} {formatCountdown(nextSyncSeconds)}</span>
                      ) : isLoadingBalance ? (
                        <span>{t('common.syncing')}</span>
                      ) : (
                        <span>{t('global.notSyncedYet')}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {hasPremium && !isExpired && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 px-3 py-1">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {t('subscription.active')}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Subscription Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative"
      >
        <div className="absolute -top-1 -left-1 -right-1 -bottom-1 bg-gradient-to-br from-eve-accent to-blue-600 rounded-2xl blur-md opacity-30" />
        <Card className="bg-eve-panel border-eve-accent/30 relative overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-2xl bg-eve-accent/10 border border-eve-accent/20 flex items-center justify-center">
                  <Crown className="h-8 w-8 text-eve-accent" />
                </div>
                <div>
                  <p className="text-eve-accent text-sm font-bold uppercase tracking-wider">{t('subscription.premium')}</p>
                  <p className="text-3xl font-black text-white">{SUBSCRIPTION_DAYS} {t('subscription.days')}</p>
                  <p className="text-zinc-500 text-sm">{formatISK(SUBSCRIPTION_COST_ISK)}</p>
                </div>
              </div>

              {session?.user?.accountCode && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700">
                  <span className="text-zinc-400 text-xs">{t('subscription.yourAccountId')}:</span>
                  <code className="text-cyan-400 font-mono text-sm">{session.user.accountCode}</code>
                </div>
              )}
              
              <div className="flex flex-col gap-3">
                <Button
                  onClick={() => setShowConfirmModal(true)}
                  disabled={!canAfford}
                  className={cn(
                    "h-12 px-8 font-black text-lg transition-all",
                    canAfford 
                      ? "bg-eve-accent text-black hover:bg-eve-accent/80 shadow-[0_0_20px_rgba(0,255,255,0.3)]" 
                      : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                  )}
                >
                  {canAfford ? t('subscription.subscribe') : t('subscription.insufficientFunds')}
                </Button>
                
                {hasPremium && !isExpired && session?.user?.subscriptionEnd && (
                  <p className="text-center text-xs text-zinc-500">
                    {t('subscription.activeStatus')}{' '}
                    <FormattedDate date={session.user.subscriptionEnd} />
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* How it works */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-4">
            <CardTitle className="text-white flex items-center gap-2">
              <Wallet className="h-5 w-5 text-eve-accent" />
              {t('subscription.howItWorks')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-sm">1</div>
              <div>
                <p className="text-white font-medium">{t('subscription.step1Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.step1Desc')}</p>
                <button
                  type="button"
                  className="mt-3 flex w-full items-center gap-3 bg-black p-3 rounded-lg border border-zinc-800 cursor-pointer hover:border-zinc-700 transition-colors text-left"
                  onClick={copyCorp}
                  aria-label={t('subscription.copyCorpAria')}
                >
                  <div className="flex-1">
                    <p className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">{t('subscription.transferTo')}</p>
                    <code className="text-eve-accent font-bold">{CORP_NAME}</code>
                  </div>
                  <div className="h-8 w-8 shrink-0 rounded bg-zinc-900 flex items-center justify-center border border-zinc-800">
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-zinc-500" />}
                  </div>
                </button>
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-sm">2</div>
              <div>
                <p className="text-white font-medium">{t('subscription.step2Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.step2Desc')}</p>
                {session?.user?.accountCode && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-zinc-400 text-xs">{t('subscription.putInReason')}</span>
                    <code className="text-cyan-400 font-mono text-sm bg-zinc-800 px-2 py-0.5 rounded">{session.user.accountCode}</code>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-start gap-4">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500 font-bold text-sm">3</div>
              <div>
                <p className="text-white font-medium">{t('subscription.step3Title')}</p>
                <p className="text-zinc-500 text-sm">{t('subscription.step3Desc')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* ISK History */}
      {iskHistory.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardHeader className="pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <History className="h-5 w-5 text-eve-accent" />
                {t('subscription.recentActivity')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {iskHistory.slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-8 w-8 rounded-lg flex items-center justify-center",
                      item.amount > 0 ? "bg-green-500/10" : "bg-red-500/10"
                    )}>
                      {item.amount > 0 ? (
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4 text-red-500 rotate-90" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{formatHistoryType(item.type)}</p>
                      <p className="text-zinc-500 text-xs"><FormattedDate date={item.createdAt} /></p>
                    </div>
                  </div>
                  <p className={cn(
                    "font-bold",
                    item.amount > 0 ? "text-green-400" : "text-red-400"
                  )}>
                    {item.amount > 0 ? '+' : ''}{formatISK(Math.abs(item.amount))}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Confirm Modal */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-eve-accent" />
              {t('subscription.confirmSubscription')}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-400 mt-2">
              {t('subscription.confirmSubscriptionDescription')}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-zinc-950 p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-zinc-400">{t('subscription.currentBalance')}</span>
                <span className="text-amber-400 font-bold">{formatISK(iskBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-400">{t('subscription.cost')}</span>
                <span className="text-red-400 font-bold">-{formatISK(SUBSCRIPTION_COST_ISK)}</span>
              </div>
              <div className="h-px bg-zinc-800" />
              <div className="flex justify-between">
                <span className="text-zinc-400">{t('subscription.afterSubscription')}</span>
                <span className="text-white font-bold">{formatISK(iskBalance - SUBSCRIPTION_COST_ISK)}</span>
              </div>
            </div>
            
            <p className="text-zinc-400 text-sm text-center">
              {t('subscription.subscribeConfirmMsg', { days: SUBSCRIPTION_DAYS })}
            </p>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowConfirmModal(false)}
              className="flex-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleSubscribe}
              disabled={isSubscribing}
              className="flex-1 bg-eve-accent text-black font-black hover:bg-eve-accent/80"
            >
              {isSubscribing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('subscription.confirm')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
