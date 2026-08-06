'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useSession } from '@/lib/session-client'
import { isPremium, isLifetimePremium } from '@/lib/utils'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import {
  ACTIVATION_CODE_TYPES,
  getActivationCodeDurationDays,
} from '@/lib/activation-codes'
import { SubscriptionPageHeader } from '@/components/subscription/SubscriptionPageHeader'
import { SubscriptionStatusStrip } from '@/components/subscription/SubscriptionStatusStrip'
import { SubscriptionPulaBanner } from '@/components/subscription/SubscriptionPulaBanner'
import { SubscriptionRedeemCard } from '@/components/subscription/SubscriptionRedeemCard'
import { SubscriptionSubscribeCard } from '@/components/subscription/SubscriptionSubscribeCard'
import { SubscriptionLifetimeAccessCard } from '@/components/subscription/SubscriptionLifetimeAccessCard'
import { SubscriptionPaymentSteps } from '@/components/subscription/SubscriptionPaymentSteps'
import {
  SubscriptionIskHistory,
  type IskHistoryItem,
} from '@/components/subscription/SubscriptionIskHistory'
import { AccountIdCard } from '@/components/settings/AccountIdCard'

const SUBSCRIPTION_COST_ISK = 100_000_000
const SUBSCRIPTION_DAYS = 30

export default function SubscriptionPage() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const redeemInputRef = useRef<HTMLInputElement | null>(null)
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
  const isExpired =
    !!session?.user?.subscriptionEnd &&
    new Date(session.user.subscriptionEnd) < new Date()
  const canAfford = iskBalance >= SUBSCRIPTION_COST_ISK
  const showPulaBanner = isPulaMember && !hasPremium
  const showRedeem = !hasPremium || isExpired || hasPromoCodeInUrl
  const isLifetime =
    hasPremium && !isExpired && isLifetimePremium(session?.user?.subscriptionEnd)

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
    const storedCode =
      typeof window !== 'undefined' ? localStorage.getItem('pulaLeeroy_personal_code') : null

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

  useEffect(() => {
    if (!lastSyncTime) return

    const SYNC_INTERVAL_MINS = 15
    const intervalMs = SYNC_INTERVAL_MINS * 60 * 1000

    const updateCountdown = () => {
      const last = new Date(lastSyncTime).getTime()
      const now = Date.now()
      const elapsed = now - last
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

  const syncHint = lastSyncTime
    ? `${t('global.nextSync')} ${formatCountdown(nextSyncSeconds)}`
    : isLoadingBalance
      ? t('common.syncing')
      : t('global.notSyncedYet')

  const handleSubscribe = async () => {
    setIsSubscribing(true)
    try {
      const res = await fetch('/api/subscription/subscribe', { method: 'POST' })
      const data = await res.json()

      if (res.ok) {
        toast.success(
          t('subscription.subscribeSuccess', {
            days: SUBSCRIPTION_DAYS,
            date: new Date(data.subscriptionEnd).toLocaleDateString(),
          })
        )
        setShowConfirmModal(false)
        window.location.reload()
      } else {
        toast.error(data.error || t('subscription.subscribeError'))
      }
    } catch {
      toast.error(t('subscription.connectionError'))
    } finally {
      setIsSubscribing(false)
    }
  }

  const formatHistoryType = (type: string) => {
    switch (type) {
      case 'payment':
        return t('subscription.payment')
      case 'subscription':
        return t('subscription.subscription')
      default:
        return t('subscription.historyTypeOther')
    }
  }

  const handleRedeemCode = async () => {
    if (!activationCode.trim()) {
      toast.error(t('subscription.codeRequired'))
      return
    }

    setIsRedeeming(true)
    try {
      const res = await fetch('/api/subscription/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activationCode.trim() }),
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
    } catch {
      toast.error(t('subscription.connectionError'))
    } finally {
      setIsRedeeming(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] animate-in space-y-6 p-4 pb-16 fade-in duration-500 md:p-8">
      <SubscriptionPageHeader />

      <SubscriptionStatusStrip
        hasPremium={hasPremium}
        isExpired={isExpired}
        subscriptionEnd={session?.user?.subscriptionEnd}
        iskBalance={iskBalance}
        isLoadingBalance={isLoadingBalance}
        syncHint={syncHint}
        canAfford={canAfford}
        subscriptionDays={SUBSCRIPTION_DAYS}
        subscriptionCostIsk={SUBSCRIPTION_COST_ISK}
      />

      {showPulaBanner && <SubscriptionPulaBanner />}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          {isLifetime ? (
            <SubscriptionLifetimeAccessCard />
          ) : (
            <SubscriptionSubscribeCard
              subscriptionDays={SUBSCRIPTION_DAYS}
              subscriptionCostIsk={SUBSCRIPTION_COST_ISK}
              canAfford={canAfford}
              hasPremium={hasPremium}
              isExpired={isExpired}
              subscriptionEnd={session?.user?.subscriptionEnd}
              iskBalance={iskBalance}
              isSubscribing={isSubscribing}
              showConfirmModal={showConfirmModal}
              onShowConfirmModal={setShowConfirmModal}
              onSubscribe={handleSubscribe}
            />
          )}

          {showRedeem && (
            <SubscriptionRedeemCard
              activationCode={activationCode}
              onActivationCodeChange={setActivationCode}
              onRedeem={handleRedeemCode}
              isRedeeming={isRedeeming}
              hasPromoCodeInUrl={hasPromoCodeInUrl}
              inputRef={redeemInputRef}
            />
          )}
        </div>

        <div className="space-y-6 lg:col-span-2">
          {session?.user?.accountCode && (
            <AccountIdCard
              accountCode={session.user.accountCode}
              label={t('settings.accountId')}
              description={t('settings.accountIdDesc')}
            />
          )}
          <SubscriptionPaymentSteps accountCode={session?.user?.accountCode} />
        </div>
      </div>

      <SubscriptionIskHistory history={iskHistory} formatHistoryType={formatHistoryType} />
    </div>
  )
}
