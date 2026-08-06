'use client'

import { Crown, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { cn, formatISK } from '@/lib/utils'
import { FormattedDate } from '@/components/shared/FormattedDate'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface SubscriptionSubscribeCardProps {
  subscriptionDays: number
  subscriptionCostIsk: number
  canAfford: boolean
  hasPremium: boolean
  isExpired: boolean
  subscriptionEnd: string | null | undefined
  iskBalance: number
  isSubscribing: boolean
  showConfirmModal: boolean
  onShowConfirmModal: (open: boolean) => void
  onSubscribe: () => void
}

export function SubscriptionSubscribeCard({
  subscriptionDays,
  subscriptionCostIsk,
  canAfford,
  hasPremium,
  isExpired,
  subscriptionEnd,
  iskBalance,
  isSubscribing,
  showConfirmModal,
  onShowConfirmModal,
  onSubscribe,
}: SubscriptionSubscribeCardProps) {
  const { t } = useTranslations()
  const premiumActive = hasPremium && !isExpired

  const sectionTitle = premiumActive
    ? t('subscription.sectionRenew')
    : t('subscription.sectionPay')

  const ctaLabel = premiumActive
    ? canAfford
      ? t('subscription.extendPremium')
      : t('subscription.renewNeedIsk')
    : canAfford
      ? t('subscription.subscribe')
      : t('subscription.insufficientFunds')

  const iskShortfall = Math.max(0, subscriptionCostIsk - iskBalance)

  return (
    <>
      <div className={cn('ta-panel p-[22px]', premiumActive && '!border-eve-accent/[0.2]')}>
        <div className="mb-4 flex items-center gap-2 border-b border-white/[0.06] pb-[14px]">
          <Crown className="h-4 w-4 text-eve-accent" />
          <h3 className="font-accent text-[13px] font-semibold uppercase tracking-[0.1em] text-ta-body">
            {sectionTitle}
          </h3>
        </div>
        <div className="space-y-4">
          {premiumActive && (
            <p className="rounded-[10px] border border-eve-accent/20 bg-eve-accent/[0.06] px-3 py-2 text-sm text-ta-body">
              {t('subscription.premiumActiveRenewDesc')}
              {subscriptionEnd && (
                <>
                  {' '}
                  <span className="text-ta-muted">
                    ({t('subscription.activeStatus')}{' '}
                    <FormattedDate date={subscriptionEnd} />)
                  </span>
                </>
              )}
            </p>
          )}

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-accent text-[10px] font-semibold uppercase tracking-[0.15em] text-ta-muted">
                {premiumActive ? t('subscription.sectionRenew') : t('subscription.premium')}
              </p>
              <p className="font-sans text-2xl font-bold tabular-nums text-white">
                {subscriptionDays} {t('subscription.days')}
              </p>
              <p className="font-sans text-sm tabular-nums text-ta-muted">{formatISK(subscriptionCostIsk)}</p>
              {!canAfford && iskShortfall > 0 && (
                <p className="mt-1 text-sm font-medium text-ta-warning">
                  {t('subscription.iskShortfall', { amount: formatISK(iskShortfall) })}
                </p>
              )}
            </div>
            <Button
              onClick={() => onShowConfirmModal(true)}
              disabled={!canAfford}
              className={cn(
                'h-12 min-w-[160px] rounded-[10px] px-6 text-base font-bold transition-all',
                canAfford
                  ? 'ta-cta font-accent'
                  : 'cursor-not-allowed border border-white/[0.08] bg-ta-inset text-ta-secondary hover:bg-ta-inset'
              )}
            >
              {ctaLabel}
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={showConfirmModal} onOpenChange={onShowConfirmModal}>
        <DialogContent className="max-w-md border-white/[0.08] bg-ta-sidebar text-ta-body">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Crown className="h-5 w-5 text-eve-accent" />
              {premiumActive
                ? t('subscription.sectionRenew')
                : t('subscription.confirmSubscription')}
            </DialogTitle>
            <DialogDescription className="mt-2 text-sm text-ta-muted">
              {t('subscription.confirmSubscriptionDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-3 rounded-[10px] border border-white/[0.08] bg-ta-inset p-4">
              <div className="flex justify-between">
                <span className="text-ta-muted">{t('subscription.currentBalance')}</span>
                <span className="font-sans font-bold tabular-nums text-ta-warning">{formatISK(iskBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ta-muted">{t('subscription.cost')}</span>
                <span className="font-sans font-bold tabular-nums text-ta-danger">−{formatISK(subscriptionCostIsk)}</span>
              </div>
              <div className="h-px bg-white/[0.08]" />
              <div className="flex justify-between">
                <span className="text-ta-muted">{t('subscription.afterSubscription')}</span>
                <span className="font-sans font-bold tabular-nums text-white">
                  {formatISK(iskBalance - subscriptionCostIsk)}
                </span>
              </div>
            </div>

            <p className="text-center text-sm text-ta-muted">
              {t('subscription.subscribeConfirmMsg', { days: subscriptionDays })}
            </p>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onShowConfirmModal(false)}
              className="flex-1 rounded-[10px] border-white/[0.08] bg-ta-inset text-ta-secondary hover:bg-white/5 hover:text-white"
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={onSubscribe}
              disabled={isSubscribing}
              className="ta-cta flex-1 rounded-[10px] font-accent font-bold"
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
    </>
  )
}
