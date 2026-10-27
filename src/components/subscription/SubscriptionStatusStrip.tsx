'use client'

import { Crown, Coins, Sparkles } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { formatISK, isLifetimePremium } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { SubscriptionSummaryStat } from '@/components/subscription/SubscriptionSummaryStat'

interface SubscriptionStatusStripProps {
  hasPremium: boolean
  isExpired: boolean
  subscriptionEnd: string | null | undefined
  iskBalance: number
  isLoadingBalance: boolean
  syncHint: string
  canAfford: boolean
  subscriptionDays: number
  subscriptionCostIsk: number
}

export function SubscriptionStatusStrip({
  hasPremium,
  isExpired,
  subscriptionEnd,
  iskBalance,
  isLoadingBalance,
  syncHint,
  canAfford,
  subscriptionDays,
  subscriptionCostIsk,
}: SubscriptionStatusStripProps) {
  const { t } = useTranslations()

  const premiumActive = hasPremium && !isExpired
  const isLifetime = premiumActive && isLifetimePremium(subscriptionEnd)

  const premiumValue = premiumActive
    ? isLifetime
      ? t('subscription.lifetimeLabel')
      : t('subscription.active')
    : isExpired
      ? t('subscription.statusExpired')
      : t('subscription.statusInactive')

  const premiumHint = isLifetime
    ? t('subscription.lifetimePremiumHint')
    : subscriptionEnd && (premiumActive || isExpired) ? (
        <span className="normal-case tracking-normal">
          {t('subscription.activeStatus')}{' '}
          <FormattedDate date={subscriptionEnd} />
        </span>
      ) : undefined

  const planValue = isLifetime
    ? t('subscription.lifetimeLabel')
    : `${subscriptionDays} ${t('subscription.days')}`

  const iskShortfall = Math.max(0, subscriptionCostIsk - iskBalance)

  const planHint = isLifetime
    ? t('subscription.lifetimePlanHint')
    : premiumActive
      ? canAfford
        ? t('subscription.planActiveHint')
        : iskShortfall > 0
          ? `${t('subscription.renewNeedIsk')} · ${t('subscription.iskShortfall', { amount: formatISK(iskShortfall) })}`
          : t('subscription.renewNeedIsk')
      : canAfford
        ? t('subscription.canSubscribe')
        : iskShortfall > 0
          ? `${t('subscription.needMoreIsk')} · ${t('subscription.iskShortfall', { amount: formatISK(iskShortfall) })}`
          : t('subscription.needMoreIsk')

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <SubscriptionSummaryStat
        title={t('subscription.statusPremium')}
        value={premiumValue}
        hint={premiumHint}
        icon={Crown}
        variant={premiumActive ? 'cyan' : 'zinc'}
      />
      <SubscriptionSummaryStat
        title={t('subscription.statusBalance')}
        value={isLoadingBalance ? '—' : formatISK(iskBalance)}
        hint={syncHint}
        icon={Coins}
        variant="amber"
        isLoading={isLoadingBalance}
      />
      <SubscriptionSummaryStat
        title={t('subscription.statusPlan')}
        value={planValue}
        hint={
          isLifetime ? planHint : `${formatISK(subscriptionCostIsk)} · ${planHint}`
        }
        icon={Sparkles}
        variant={isLifetime || premiumActive || canAfford ? 'accent' : 'zinc'}
      />
    </div>
  )
}
